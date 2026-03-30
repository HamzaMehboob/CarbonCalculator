from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from pymongo import MongoClient
import datetime
import os
import sys

app = Flask(__name__)
# Enable CORS for all origins in development/testing
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# MongoDB Configuration
CONNECTION_STRING = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/carbon_calculator')

def get_db():
    try:
        # Added tlsAllowInvalidCertificates=True to bypass common SSL issues on cloud providers
        client = MongoClient(CONNECTION_STRING, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        # Check connection
        client.admin.command('ping')
        
        db = client.get_default_database() if '?' not in CONNECTION_STRING else client[CONNECTION_STRING.split('/')[-1].split('?')[0] or 'carbon_calculator']
        if not db.name or db.name == 'admin':
            db = client['carbon_calculator']
        return db
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}", file=sys.stderr)
        return None

# Lazy collection access helpers
def get_users_col():
    db = get_db()
    return db['users'] if db is not None else None

def get_data_col():
    db = get_db()
    return db['user_data'] if db is not None else None

def get_factors_col():
    db = get_db()
    return db['conversion_factors'] if db is not None else None

# Conversion Factors
DEFAULT_CONVERSION_FACTORS = {
    "UK_2025": {
        "version": "2025.1",
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
    col = get_factors_col()
    if not col: return []
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
        col.update_one(
            {"email": email, "country_key": key},
            {"$setOnInsert": doc},
            upsert=True
        )
        doc.pop('_id', None)
        inserted_factors.append(doc)
    return inserted_factors

# Security
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'default-dev-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

@app.route('/', methods=['GET'])
def home():
    db_status = "connected" if get_db() is not None else "disconnected"
    return jsonify({"status": "healthy", "db": db_status, "service": "Carbon Calculator API"}), 200

@app.route('/api/signup', methods=['POST'])
def signup():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error. Please check MongoDB whitelist or URI."}), 503
        
    data = request.get_json()
    if not data: return jsonify({"msg": "Missing JSON"}), 400
        
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    
    if not email or not password or not confirm_password:
        return jsonify({"msg": "Missing required fields"}), 400
        
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
        
    if users_col.find_one({"email": email}):
        return jsonify({"msg": "User already exists"}), 400
        
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    users_col.insert_one({
        "email": email,
        "password": hashed_password,
        "full_name": data.get('full_name'),
        "company_name": data.get('company_name'),
        "created_at": datetime.datetime.utcnow()
    })
    
    access_token = create_access_token(identity=email)
    return jsonify({"msg": "User created", "access_token": access_token}), 201

@app.route('/api/login', methods=['POST'])
def login():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
        
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    user = users_col.find_one({"email": email})
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

@app.route('/api/data', methods=['GET'])
@jwt_required()
def get_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    user_data = data_col.find_one({"email": current_user_email})
    
    if user_data:
        user_data['_id'] = str(user_data['_id'])
        return jsonify(user_data), 200
    return jsonify({"email": current_user_email, "sites": {}}), 200

@app.route('/api/data', methods=['POST'])
@jwt_required()
def save_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    data = request.get_json()
    data['email'] = current_user_email
    data['updated_at'] = datetime.datetime.utcnow()
    
    data_col.update_one({"email": current_user_email}, {"$set": data}, upsert=True)
    return jsonify({"msg": "Data saved"}), 200

@app.route('/api/factors', methods=['GET', 'POST'])
@jwt_required()
def handle_factors():
    factors_col = get_factors_col()
    if factors_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    
    if request.method == 'GET':
        factors = list(factors_col.find({"email": current_user_email}, {"_id": 0}))
        if not factors:
            factors = init_user_factors(current_user_email)
        return jsonify(factors), 200
        
    if request.method == 'POST':
        data = request.get_json()
        if not data: return jsonify({"msg": "Missing JSON"}), 400
        
        country_key = data.get('country_key')
        factors = data.get('factors')
        
        if not country_key or not factors:
            return jsonify({"msg": "Missing country_key or factors"}), 400
            
        doc = {
            "email": current_user_email,
            "country_key": country_key,
            "version": data.get("version", "Custom"),
            "source": data.get("source", "Imported"),
            "factors": factors,
            "updated_at": datetime.datetime.utcnow()
        }
        
        factors_col.update_one(
            {"email": current_user_email, "country_key": country_key},
            {"$set": doc},
            upsert=True
        )
        return jsonify({"msg": "Factors saved successfully"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
