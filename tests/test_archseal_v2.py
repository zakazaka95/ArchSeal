import importlib.util
import json
import pathlib
import sys
import types
import unittest


class UserError(Exception):
    pass


class u64(int):
    pass


class u256(int):
    pass


class TreeMap(dict):
    pass


class Address(str):
    pass


class _Decorator:
    def __call__(self, value):
        return value

    @property
    def payable(self):
        return self


class _Public:
    write = _Decorator()
    view = _Decorator()


class _Evm:
    @staticmethod
    def contract_interface(value):
        return value


class _Message:
    sender_address = "0x" + ("1" * 40)
    origin_address = sender_address
    contract_address = "0x" + ("a" * 40)
    chain_id = u256(4221)
    value = u256(0)


class _Response:
    def __init__(self, body, status=200):
        self.status_code = status
        if isinstance(body, bytes):
            self.body = body
        elif isinstance(body, str):
            self.body = body.encode("utf-8")
        else:
            self.body = json.dumps(body).encode("utf-8")


class _Web:
    responses = {}

    def get(self, url, headers=None):
        if url not in self.responses:
            raise AssertionError(f"Unexpected URL: {url}")
        value = self.responses[url]
        return value() if callable(value) else value


class _Nondet:
    def __init__(self):
        self.web = _Web()
        self.candidates = []
        self.prompt_calls = 0

    def exec_prompt(self, prompt, response_format=None):
        self.prompt_calls += 1
        if not self.candidates:
            raise AssertionError("No LLM candidate configured")
        return self.candidates.pop(0)


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _VM:
    Return = _Return

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        candidate = leader_fn()
        if not validator_fn(_Return(candidate)):
            raise AssertionError("Validator rejected the leader result")
        return candidate


class _EqPrinciple:
    @staticmethod
    def strict_eq(function):
        return function()


def _load_contract():
    fake_genlayer = types.ModuleType("genlayer")
    fake_gl = types.SimpleNamespace(
        Contract=object,
        UserError=UserError,
        public=_Public(),
        evm=_Evm(),
        message=_Message(),
        nondet=_Nondet(),
        vm=_VM(),
        eq_principle=_EqPrinciple(),
    )
    fake_genlayer.gl = fake_gl
    fake_genlayer.TreeMap = TreeMap
    fake_genlayer.u64 = u64
    fake_genlayer.u256 = u256
    fake_genlayer.Address = Address
    sys.modules["genlayer"] = fake_genlayer

    source = pathlib.Path(__file__).parents[1] / "contracts" / "ArchSealV2.py"
    spec = importlib.util.spec_from_file_location("archseal_v2_contract", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


arch = _load_contract()

OWNER = "acme"
REPO = "ledger"
SPONSOR = "0x" + ("1" * 40)
CONTRIBUTOR = "0x" + ("2" * 40)
BASE = "a" * 40
HEAD = "b" * 40


def api(suffix):
    return f"https://api.github.com/repos/{OWNER}/{REPO}/{suffix}"


def raw(commit, path):
    return f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{commit}/{path}"


def policy(require_complete=True):
    return {
        "schema": "archseal-policy-v1",
        "policy_version": "1.0.0",
        "repository": f"{OWNER}/{REPO}",
        "adr_path": "docs/adr",
        "maintainers": ["maintainer-one"],
        "require_complete_evidence": require_complete,
    }


class ArchSealV2Tests(unittest.TestCase):
    def setUp(self):
        arch.gl.message.sender_address = SPONSOR
        arch.gl.message.origin_address = SPONSOR
        arch.gl.message.value = u256(0)
        arch.gl.nondet.candidates = []
        arch.gl.nondet.prompt_calls = 0
        arch.gl.nondet.web.responses = {
            api("pulls/7"): _Response(
                {"base": {"sha": BASE}, "head": {"sha": HEAD}}
            ),
            raw(BASE, ".archseal/policy.json"): _Response(policy()),
        }
        self.opened_at = "2026-08-21T20:00:00+00:00"
        arch._now = lambda: self.opened_at
        self.contract = arch.ArchSeal()

    def open_review(self):
        return self.contract.open_review(
            OWNER,
            REPO,
            u64(7),
            CONTRIBUTOR,
        )

    def add_complete_evidence(self):
        arch.gl.nondet.web.responses.update(
            {
                api(f"contents/docs/adr?ref={BASE}"): _Response(
                    [
                        {
                            "type": "file",
                            "path": "docs/adr/ADR-0001.md",
                        }
                    ]
                ),
                raw(BASE, "docs/adr/ADR-0001.md"): _Response(
                    "# ADR 0001\nAll state must be read from the contract."
                ),
                api(f"compare/{BASE}...{HEAD}"): _Response(
                    {
                        "files": [
                            {
                                "filename": "src/state.ts",
                                "status": "modified",
                                "additions": 2,
                                "deletions": 1,
                                "patch": "@@ -1 +1 @@\n-readCache()\n+readContract()",
                            }
                        ]
                    }
                ),
            }
        )

    def verdict(self, review, decision="COMPLIANT"):
        if decision == "COMPLIANT":
            return {
                "review_id": review["id"],
                "decision": "COMPLIANT",
                "score": 96,
                "risk_level": "LOW",
                "summary": "The visible change reads accepted contract state and does not contradict the pinned ADR.",
                "violated_adrs": [],
                "findings": [],
                "base_sha": BASE,
                "head_sha": HEAD,
                "policy_hash": review["policy_hash"],
            }
        raise AssertionError("Unsupported test decision")

    def test_policy_controls_scope_and_review_id_uses_transaction_context(self):
        first = self.open_review()
        self.assertEqual(first["adr_path"], "docs/adr")
        self.assertEqual(first["policy_path"], ".archseal/policy.json")
        self.assertEqual(len(first["policy_hash"]), 64)
        self.assertEqual(len(first["id"]), 64)
        self.assertEqual(first["sequence"], 1)

        self.opened_at = "2026-08-21T20:00:01+00:00"
        second = self.open_review()
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(second["sequence"], 2)
        latest = self.contract.get_latest_review(SPONSOR)
        self.assertEqual(latest["id"], second["id"])
        recent = self.contract.get_recent_reviews(u64(2))
        self.assertEqual([item["id"] for item in recent], [second["id"], first["id"]])

    def test_repository_policy_must_require_complete_evidence(self):
        arch.gl.nondet.web.responses[
            raw(BASE, ".archseal/policy.json")
        ] = _Response(policy(require_complete=False))
        with self.assertRaises(UserError):
            self.open_review()

    def test_complete_evidence_can_produce_sealed_compliant_review(self):
        review = self.open_review()
        self.add_complete_evidence()
        candidate = self.verdict(review)
        arch.gl.nondet.candidates = [candidate, candidate]

        evaluated = self.contract.evaluate_review(review["id"])
        self.assertEqual(evaluated["status"], "COMPLIANT")
        self.assertTrue(evaluated["last_verdict"]["evidence_complete"])
        self.assertEqual(evaluated["last_verdict"]["incomplete_reasons"], [])
        self.assertEqual(len(evaluated["seal_hash"]), 64)
        self.assertEqual(arch.gl.nondet.prompt_calls, 2)

    def test_truncated_patch_forces_inconclusive_without_llm(self):
        review = self.open_review()
        self.add_complete_evidence()
        compare_url = api(f"compare/{BASE}...{HEAD}")
        arch.gl.nondet.web.responses[compare_url] = _Response(
            {
                "files": [
                    {
                        "filename": "src/large.ts",
                        "status": "modified",
                        "additions": 5000,
                        "deletions": 0,
                        "patch": "x" * (arch.MAX_PATCH_CHARS_PER_FILE + 1),
                    }
                ]
            }
        )

        evaluated = self.contract.evaluate_review(review["id"])
        verdict = evaluated["last_verdict"]
        self.assertEqual(evaluated["status"], "INCONCLUSIVE")
        self.assertFalse(verdict["evidence_complete"])
        self.assertIn("At least one changed-file patch was truncated.", verdict["incomplete_reasons"])
        self.assertEqual(arch.gl.nondet.prompt_calls, 0)


if __name__ == "__main__":
    unittest.main()
