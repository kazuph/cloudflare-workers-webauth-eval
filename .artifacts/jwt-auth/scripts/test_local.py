"""JWT Auth API - Local Server Test"""
import json
from playwright.sync_api import sync_playwright
import os

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8787")
ARTIFACTS_DIR = "/Users/kazuph/src/github.com/kazuph/cloudflare-workers-webauth-eval/.artifacts/jwt-auth"

def test_api():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        request = context.request

        print(f"=" * 60)
        print(f"JWT Auth API Test - Target: {BASE_URL}")
        print(f"=" * 60)

        # Test 1: HS256 Full Flow
        print("\n[HS256] Testing full authentication flow...")

        # Login
        login_resp = request.post(
            f"{BASE_URL}/auth/hs256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        hs256_result = {
            "algorithm": "HS256",
            "login": {"status": login_resp.status, "success": login_resp.status == 200},
        }

        if login_resp.status == 200:
            access_token = login_data["accessToken"]
            refresh_token = login_data["refreshToken"]

            # Verify
            verify_resp = request.get(
                f"{BASE_URL}/auth/hs256/verify",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            hs256_result["verify"] = {"status": verify_resp.status, "success": verify_resp.status == 200}

            # Protected
            protected_resp = request.get(
                f"{BASE_URL}/auth/hs256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            hs256_result["protected"] = {"status": protected_resp.status, "success": protected_resp.status == 200}

            # Refresh
            refresh_resp = request.post(
                f"{BASE_URL}/auth/hs256/refresh",
                headers={"Authorization": f"Bearer {refresh_token}"}
            )
            hs256_result["refresh"] = {"status": refresh_resp.status, "success": refresh_resp.status == 200}

        results.append(hs256_result)
        print(f"   Login: {hs256_result['login']['status']}")
        print(f"   Verify: {hs256_result.get('verify', {}).get('status', 'N/A')}")
        print(f"   Protected: {hs256_result.get('protected', {}).get('status', 'N/A')}")
        print(f"   Refresh: {hs256_result.get('refresh', {}).get('status', 'N/A')}")

        # Test 2: RS256 Full Flow
        print("\n[RS256] Testing full authentication flow...")

        login_resp = request.post(
            f"{BASE_URL}/auth/rs256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        rs256_result = {
            "algorithm": "RS256",
            "login": {"status": login_resp.status, "success": login_resp.status == 200},
        }

        if login_resp.status == 200:
            access_token = login_data["accessToken"]
            refresh_token = login_data["refreshToken"]

            verify_resp = request.get(
                f"{BASE_URL}/auth/rs256/verify",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            rs256_result["verify"] = {"status": verify_resp.status, "success": verify_resp.status == 200}

            protected_resp = request.get(
                f"{BASE_URL}/auth/rs256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            rs256_result["protected"] = {"status": protected_resp.status, "success": protected_resp.status == 200}

            refresh_resp = request.post(
                f"{BASE_URL}/auth/rs256/refresh",
                headers={"Authorization": f"Bearer {refresh_token}"}
            )
            rs256_result["refresh"] = {"status": refresh_resp.status, "success": refresh_resp.status == 200}

        results.append(rs256_result)
        print(f"   Login: {rs256_result['login']['status']}")
        print(f"   Verify: {rs256_result.get('verify', {}).get('status', 'N/A')}")
        print(f"   Protected: {rs256_result.get('protected', {}).get('status', 'N/A')}")
        print(f"   Refresh: {rs256_result.get('refresh', {}).get('status', 'N/A')}")

        # Test 3: ES256 Full Flow
        print("\n[ES256] Testing full authentication flow...")

        login_resp = request.post(
            f"{BASE_URL}/auth/es256/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            headers={"Content-Type": "application/json"}
        )
        login_data = login_resp.json()
        es256_result = {
            "algorithm": "ES256",
            "login": {"status": login_resp.status, "success": login_resp.status == 200},
        }

        if login_resp.status == 200:
            access_token = login_data["accessToken"]
            refresh_token = login_data["refreshToken"]

            verify_resp = request.get(
                f"{BASE_URL}/auth/es256/verify",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            es256_result["verify"] = {"status": verify_resp.status, "success": verify_resp.status == 200}

            protected_resp = request.get(
                f"{BASE_URL}/auth/es256/protected",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            es256_result["protected"] = {"status": protected_resp.status, "success": protected_resp.status == 200}

            refresh_resp = request.post(
                f"{BASE_URL}/auth/es256/refresh",
                headers={"Authorization": f"Bearer {refresh_token}"}
            )
            es256_result["refresh"] = {"status": refresh_resp.status, "success": refresh_resp.status == 200}

        results.append(es256_result)
        print(f"   Login: {es256_result['login']['status']}")
        print(f"   Verify: {es256_result.get('verify', {}).get('status', 'N/A')}")
        print(f"   Protected: {es256_result.get('protected', {}).get('status', 'N/A')}")
        print(f"   Refresh: {es256_result.get('refresh', {}).get('status', 'N/A')}")

        # Test JWKS
        print("\n[JWKS] Testing public keys endpoint...")
        jwks_resp = request.get(f"{BASE_URL}/.well-known/jwks.json")
        jwks_data = jwks_resp.json()
        print(f"   Status: {jwks_resp.status}")
        print(f"   Keys: {len(jwks_data.get('keys', []))}")

        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        all_pass = True
        for r in results:
            alg = r["algorithm"]
            login_ok = r["login"]["success"]
            verify_ok = r.get("verify", {}).get("success", False)
            protected_ok = r.get("protected", {}).get("success", False)
            refresh_ok = r.get("refresh", {}).get("success", False)
            status = "✅ PASS" if all([login_ok, verify_ok, protected_ok, refresh_ok]) else "❌ FAIL"
            if not all([login_ok, verify_ok, protected_ok, refresh_ok]):
                all_pass = False
            print(f"  {alg}: {status}")

        print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_pass else '❌ SOME TESTS FAILED'}")
        print(f"Target: {BASE_URL}")
        browser.close()

        return all_pass, results

if __name__ == "__main__":
    test_api()
