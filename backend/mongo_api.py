from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from pymongo import MongoClient
import datetime
import os

app = Flask(__name__)
# Enable CORS for the Streamlit app URL and localhost
CORS(app, resources={r"/api/*": {"origins": ["*"]}})

# MongoDB Configuration
# Use environment variable for security - MUST set this in Render.com
# Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
CONNECTION_STRING = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/carbon_calculator')

client = MongoClient(CONNECTION_STRING)
db = client.get_default_database() if '?' not in CONNECTION_STRING else client[CONNECTION_STRING.split('/')[-1].split('?')[0] or 'carbon_calculator']
# Fallback database name if not specified in URI
if not db.name or db.name == 'admin':
    db = client['carbon_calculator']

users_collection = db['users']
data_collection = db['user_data']
factors_collection = db['conversion_factors']

# Conversion Factors (Default ones)
DEFAULT_CONVERSION_FACTORS = {
    "UK_2025": {
        "version": "2025.1",
        "source": "UK Government GHG Conversion Factors 2025",
        "url": "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
        "last_updated": "2025-06-01",
        "factors": {
            "water_supply": 0.344, "water_treatment": 0.708,
            "electricity_grid": 0.177, "natural_gas": 0.183, "heating_oil": 0.246, "coal": 0.317, "lpg": 0.214,
            "waste_landfill": 467.0, "waste_incineration": 21.28, "waste_recycled": 21.3, "waste_composted": 8.8,
            "car_petrol_small": 0.149, "car_petrol_medium": 0.188, "car_petrol_large": 0.280,
            "car_diesel_small": 0.139, "car_diesel_medium": 0.166, "car_diesel_large": 0.227,
            "car_electric": 0.053, "car_hybrid": 0.113,
            "van_diesel": 0.788, "van_petrol": 0.804, "van_electric": 0.169,
            "flight_domestic": 0.246, "flight_short_intl": 0.156, "flight_long_intl": 0.195,
            "refrigerant_R410A": 2088, "refrigerant_R134a": 1430, "refrigerant_R32": 675, "refrigerant_R404A": 3922, "refrigerant_R407C": 1774,
        }
    },
    "BRAZIL_2025": {
        "factors": {
            "water_supply": 0.421, "water_treatment": 0.856,
            "electricity_grid": 0.233, "natural_gas": 0.202, "heating_oil": 0.264, "lpg": 0.226,
            "waste_landfill": 521.0, "waste_incineration": 25.84, "waste_recycled": 24.6, "waste_composted": 10.2,
            "car_petrol_small": 0.158, "car_petrol_medium": 0.197, "car_petrol_large": 0.294,
            "car_diesel_small": 0.148, "car_diesel_medium": 0.176, "car_diesel_large": 0.241,
            "car_electric": 0.062, "car_hybrid": 0.124, "car_flex": 0.182,
            "van_diesel": 0.831, "van_petrol": 0.847, "van_electric": 0.186,
            "flight_domestic": 0.264, "flight_short_intl": 0.165, "flight_long_intl": 0.208,
            "refrigerant_R410A": 2088, "refrigerant_R134a": 1430, "refrigerant_R32": 675, "refrigerant_R404A": 3922, "refrigerant_R407C": 1774,
        }
    }
}

def init_user_factors(email):
    inserted_factors = []
    for key, data in DEFAULT_CONVERSION_FACTORS.items():
        doc = {
            "email": email,
            "country_key": key,
            "version": data.get("version", "2025"),
            "source": data.get("source", "Default"),
            "factors": data["factors"],
            "updated_at": datetime.datetime.utcnow()
        }
        factors_collection.update_one(
            {"email": email, "country_key": key},
            {"$setOnInsert": doc},
            upsert=True
        )
        doc.pop('_id', None)
        inserted_factors.append(doc)
    return inserted_factors

# Security Configuration
# Set JWT_SECRET_KEY in Render.com
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'default-dev-key-change-this')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "healthy", "service": "Carbon Calculator API"}), 200

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON in request"}), 400
        
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    full_name = data.get('full_name')
    company_name = data.get('company_name')
    
    if not email or not password or not confirm_password:
        return jsonify({"msg": "Missing required fields"}), 400
        
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
        
    if len(password) < 6:
        return jsonify({"msg": "Password must be at least 6 characters"}), 400
        
    if users_collection.find_one({"email": email}):
        return jsonify({"msg": "User with this email already exists"}), 400
        
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    
    users_collection.insert_one({
        "email": email,
        "password": hashed_password,
        "full_name": full_name,
        "company_name": company_name,
        "created_at": datetime.datetime.utcnow()
    })
    
    access_token = create_access_token(identity=email)
    return jsonify({"msg": "User created successfully", "access_token": access_token}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON in request"}), 400
    email = data.get('email')
    password = data.get('password')
    
    user = users_collection.find_one({"email": email})
    if user and bcrypt.check_password_hash(user['password'], password):
        access_token = create_access_token(identity=email)
        return jsonify({
            "access_token": access_token,
            "user": {
                "email": user['email'],
                "full_name": user.get('full_name'),
                "company_name": user.get('company_name')
            }
        }), 200
    
    return jsonify({"msg": "Invalid email or password"}), 401

@app.route('/api/user', methods=['POST'])
@jwt_required()
def update_user_profile():
    current_user_email = get_jwt_identity()
    data = request.get_json()
    
    company_name = data.get('company_name')
    if not company_name:
        return jsonify({"msg": "Company name is required"}), 400
        
    users_collection.update_one(
        {"email": current_user_email},
        {"$set": {"company_name": company_name}}
    )
    
    return jsonify({"msg": "Profile updated successfully"}), 200

@app.route('/api/data', methods=['GET'])
@jwt_required()
def get_user_data():
    current_user_email = get_jwt_identity()
    user_data = data_collection.find_one({"email": current_user_email})
    
    if user_data:
        user_data['_id'] = str(user_data['_id'])
        return jsonify(user_data), 200
    else:
        return jsonify({
            "email": current_user_email,
            "sites": {}
        }), 200

@app.route('/api/data', methods=['POST'])
@jwt_required()
def save_user_data():
    current_user_email = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON in request"}), 400
    
    data['email'] = current_user_email
    data['updated_at'] = datetime.datetime.utcnow()
    
    data_collection.update_one(
        {"email": current_user_email},
        {"$set": data},
        upsert=True
    )
    
    return jsonify({"msg": "Data saved successfully"}), 200

@app.route('/api/factors', methods=['GET'])
@jwt_required()
def get_factors():
    current_user_email = get_jwt_identity()
    factors = list(factors_collection.find({"email": current_user_email}, {"_id": 0}))
    
    if not factors:
        factors = init_user_factors(current_user_email)
        
    return jsonify(factors), 200

@app.route('/api/factors', methods=['POST'])
@jwt_required()
def update_factors():
    current_user_email = get_jwt_identity()
    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON in request"}), 400
    country_key = data.get('country_key')
    factors = data.get('factors')
    
    if not country_key or not factors:
        return jsonify({"msg": "Country key and factors are required"}), 400
        
    factors_collection.update_one(
        {"email": current_user_email, "country_key": country_key},
        {"$set": {
            "factors": factors,
            "updated_at": datetime.datetime.utcnow()
        }},
        upsert=True
    )
    
    return jsonify({"msg": "Factors updated successfully"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
