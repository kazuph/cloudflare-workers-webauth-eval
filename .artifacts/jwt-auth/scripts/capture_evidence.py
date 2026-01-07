"""JWT Auth API - Evidence Capture Script"""
import json
import os
from datetime import datetime
from playwright.sync_api import sync_playwright

REMOTE_URL = "https://jwt-auth-eval.kazu-san.workers.dev"
ARTIFACTS_DIR = "/Users/kazuph/src/github.com/kazuph/cloudflare-workers-webauth-eval/.artifacts/jwt-auth"

def capture_evidence():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1200, "height": 800})
        page = context.new_page()
        request = context.request
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        print(f"Capturing evidence for: {REMOTE_URL}")
        print("=" * 60)

        # 1. API Info
        print("\n[1] GET / - API Info")
        resp = request.get(f"{REMOTE_URL}/")
        data = resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_01_api_info.json", "w") as f:
            json.dump(data, f, indent=2)
        page.goto(f"{REMOTE_URL}/")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{ARTIFACTS_DIR}/images/{timestamp}_01_api_info.png", full_page=True)
        print(f"   Status: {resp.status}")

        # 2. Health Check
        print("\n[2] GET /health")
        resp = request.get(f"{REMOTE_URL}/health")
        data = resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_02_health.json", "w") as f:
            json.dump(data, f, indent=2)
        page.goto(f"{REMOTE_URL}/health")
        page.screenshot(path=f"{ARTIFACTS_DIR}/images/{timestamp}_02_health.png", full_page=True)
        print(f"   Status: {resp.status}")

        # 3. Algorithms
        print("\n[3] GET /algorithms")
        resp = request.get(f"{REMOTE_URL}/algorithms")
        data = resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_03_algorithms.json", "w") as f:
            json.dump(data, f, indent=2)
        page.goto(f"{REMOTE_URL}/algorithms")
        page.screenshot(path=f"{ARTIFACTS_DIR}/images/{timestamp}_03_algorithms.png", full_page=True)
        print(f"   Status: {resp.status}")

        # 4. JWKS
        print("\n[4] GET /.well-known/jwks.json")
        resp = request.get(f"{REMOTE_URL}/.well-known/jwks.json")
        data = resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_04_jwks.json", "w") as f:
            json.dump(data, f, indent=2)
        page.goto(f"{REMOTE_URL}/.well-known/jwks.json")
        page.screenshot(path=f"{ARTIFACTS_DIR}/images/{timestamp}_04_jwks.png", full_page=True)
        print(f"   Status: {resp.status}, Keys: {len(data.get('keys', []))}")

        # 5. HS256 Login Flow
        print("\n[5] HS256 Authentication Flow")
        login_resp = request.post(
            f"{REMOTE_URL}/auth/hs256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_05_hs256_login.json", "w") as f:
            safe_data = {k: v[:50] + "..." if isinstance(v, str) and len(v) > 50 else v for k, v in login_data.items()}
            json.dump(safe_data, f, indent=2)
        print(f"   Login: {login_resp.status}")

        if login_resp.status == 200:
            access_token = login_data["accessToken"]

            # Protected Resource
            protected_resp = request.get(
                f"{REMOTE_URL}/auth/hs256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            protected_data = protected_resp.json()
            with open(f"{ARTIFACTS_DIR}/images/{timestamp}_05_hs256_protected.json", "w") as f:
                json.dump(protected_data, f, indent=2)
            print(f"   Protected: {protected_resp.status}")

        # 6. RS256 Login Flow
        print("\n[6] RS256 Authentication Flow")
        login_resp = request.post(
            f"{REMOTE_URL}/auth/rs256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_06_rs256_login.json", "w") as f:
            safe_data = {k: v[:50] + "..." if isinstance(v, str) and len(v) > 50 else v for k, v in login_data.items()}
            json.dump(safe_data, f, indent=2)
        print(f"   Login: {login_resp.status}")

        if login_resp.status == 200:
            access_token = login_data["accessToken"]
            protected_resp = request.get(
                f"{REMOTE_URL}/auth/rs256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            protected_data = protected_resp.json()
            with open(f"{ARTIFACTS_DIR}/images/{timestamp}_06_rs256_protected.json", "w") as f:
                json.dump(protected_data, f, indent=2)
            print(f"   Protected: {protected_resp.status}")

        # 7. ES256 Login Flow
        print("\n[7] ES256 Authentication Flow")
        login_resp = request.post(
            f"{REMOTE_URL}/auth/es256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        with open(f"{ARTIFACTS_DIR}/images/{timestamp}_07_es256_login.json", "w") as f:
            safe_data = {k: v[:50] + "..." if isinstance(v, str) and len(v) > 50 else v for k, v in login_data.items()}
            json.dump(safe_data, f, indent=2)
        print(f"   Login: {login_resp.status}")

        if login_resp.status == 200:
            access_token = login_data["accessToken"]
            protected_resp = request.get(
                f"{REMOTE_URL}/auth/es256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            protected_data = protected_resp.json()
            with open(f"{ARTIFACTS_DIR}/images/{timestamp}_07_es256_protected.json", "w") as f:
                json.dump(protected_data, f, indent=2)
            print(f"   Protected: {protected_resp.status}")

        browser.close()
        print("\n" + "=" * 60)
        print(f"Evidence saved to: {ARTIFACTS_DIR}/images/")
        return timestamp

if __name__ == "__main__":
    capture_evidence()
