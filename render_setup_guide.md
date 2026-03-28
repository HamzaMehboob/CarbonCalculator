# 🚀 Render.com Deployment Guide

To fix the MongoDB credential leak and move your backend to Render.com, follow these steps.

## 1. Prepare your GitHub Repository
1.  **Commit the changes** I just made (refactored [backend/mongo_api.py](file:///c:/Users/ISYS/Documents/GitHub/CarbonCalculator/backend/mongo_api.py) and [backend/requirements.txt](file:///c:/Users/ISYS/Documents/GitHub/CarbonCalculator/backend/requirements.txt)).
2.  **Push** them to your GitHub repository.
    *   *Note: The hardcoded credentials have been removed and replaced with `os.environ.get('MONGODB_URI')`.*

## 2. Create a new Web Service on Render
1.  Go to [Render.com](https://render.com/) and log in.
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub repository.
4.  Configure the service:
    *   **Name:** `carbon-calculator-api` (or any name you like)
    *   **Root Directory:** `backend` (Important! This tells Render to look inside the backend folder)
    *   **Environment:** `Python 3`
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `gunicorn mongo_api:app` (This starts the Flask app using Gunicorn)

## 3. Set Environment Variables
In the Render dashboard for your new service, go to the **Environment** tab and add the following variables:

| Key | Value |
| :--- | :--- |
| `MONGODB_URI` | `mongodb+srv://hamzamehboob103_db_user:Yf2m6xtao73allOJ@cluster0.yl1fnm7.mongodb.net/carbon_calculator?retryWrites=true&w=majority` |
| `JWT_SECRET_KEY` | `your-secret-key-make-it-long-and-random` |

> [!IMPORTANT]
> This is where you safely store your MongoDB credentials. Render will inject them into the app at runtime, and they will NOT be visible on GitHub.

## 4. Update Frontend URL
1.  Once Render finishes deploying, it will give you a URL (e.g., `https://carbon-calculator-api.onrender.com`).
2.  Open [frontend/js/app.js](file:///c:/Users/ISYS/Documents/GitHub/CarbonCalculator/frontend/js/app.js) in your local code.
3.  Update the `API_BASE_URL` on line 41:
    ```javascript
    const API_BASE_URL = 'https://carbon-calculator-api.onrender.com/api';
    ```
4.  Commit and push this change to GitHub.

## 5. Update Streamlit (if deployed)
If you are using Streamlit Cloud for the frontend:
1.  Re-deploy or reboot your Streamlit app so it picks up the updated [app.js](file:///c:/Users/ISYS/Documents/GitHub/CarbonCalculator/frontend/js/app.js) from GitHub.
2.  Your frontend will now communicate with the Render backend, which in turn communicates with MongoDB securely.

## 🛠️ Local Testing
If you want to test locally after these changes:
1.  Install dependencies: `pip install -r backend/requirements.txt`
2.  Set your environment variable (PowerShell): `$env:MONGODB_URI="your_mongodb_uri_here"`
3.  Run the backend: `python backend/mongo_api.py`
4.  The frontend will connect to `localhost:5000` if you revert the `API_BASE_URL` temporarily.
