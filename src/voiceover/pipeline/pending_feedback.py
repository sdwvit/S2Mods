"""Print feedback that still needs an agent, one JSON record per line; exit 0 if any printed.
Asks the review server (GET /api/pending): records with no event that the server does not handle itself
(picks/unpicks and comment-less edited text), plus any record with a comment no agent event answers yet."""
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402
left = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{vo_env.PORT}/api/pending", timeout=10).read())
print("\n".join(json.dumps(f, ensure_ascii=False) for f in left))
sys.exit(0 if left else 1)
