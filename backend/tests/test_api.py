import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_flow():
    with TestClient(app) as c:
        wallets = {w["name"]: w["id"] for w in c.get("/api/wallets").json()}
        assert set(wallets) == {"Личное", "Бизнес"}
        c.patch(f"/api/wallets/{wallets['Бизнес']}", json={"initial_balance": 100000})

        cats = c.get("/api/categories").json()
        assert len(cats) == 5 + 6 + 5
        chem = next(x for x in cats if x["name"] == "Химия и средства")
        income = next(x for x in cats if x["name"] == "Офис")
        c.patch(f"/api/categories/{chem['id']}", json={"monthly_limit": 200000})

        def tx(**kw):
            return c.post("/api/transactions", json={"date": "2026-09-15", **kw})

        assert tx(type="income", amount=500000, wallet_id=wallets["Бизнес"], category_id=income["id"]).status_code == 201
        assert tx(type="expense", amount=50000, wallet_id=wallets["Бизнес"], category_id=chem["id"]).status_code == 201
        assert tx(type="transfer", amount=100000, wallet_id=wallets["Бизнес"], to_wallet_id=wallets["Личное"]).status_code == 201
        # неверные операции
        assert tx(type="expense", amount=100, wallet_id=wallets["Личное"], category_id=chem["id"]).status_code == 422
        assert tx(type="expense", amount=0, wallet_id=wallets["Личное"]).status_code == 422
        assert tx(type="transfer", amount=1, wallet_id=1, to_wallet_id=1).status_code == 422

        s = c.get("/api/summary", params={"on": "2026-09-15"}).json()
        bal = {b["name"]: b["balance"] for b in s["balances"]}
        assert bal == {"Бизнес": 100000 + 500000 - 50000 - 100000, "Личное": 100000}
        assert s["day"] == {"income": 500000, "expense": 50000}
        assert s["month"] == {"income": 500000, "expense": 50000}
        u = next(x for x in s["categories"] if x["category_id"] == chem["id"])
        assert u["spent"] == 50000 and u["percent"] == 25.0
        assert c.get("/api/summary", params={"on": "2026-10-01"}).json()["month"]["expense"] == 0
