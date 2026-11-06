"""Add a job to the review server's queue (POST /api/queue) and print it.

usage: python3 -I enqueue.py --key KEY [--label L] [--group batch:<b>] [--sid SID] [--feedback-id ID] [--priority N]
                             [--input PATH]... [--output PATH]... [--cpu] -- <command> [args...] [--then <command> [args...]]...
A new job with the same KEY supersedes queued ones and stops the running one. With --output (and --input), the job is
skipped when every output is newer than every input and the commands are unchanged. Paths are relative to the
workspace root, where the commands also run. Every step runs; the job fails if any step fails. GPU jobs (the default)
hold review/jobs/gpu.lock while they run; --cpu jobs don't. Exits 1 when the server is not running.
"""
import argparse, json, os, sys, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vo_env  # noqa: E402

argv = sys.argv[1:]
if "--" not in argv:
    sys.exit("usage: enqueue.py --key KEY [options] -- <command> [args...] [--then <command> ...]")
i = argv.index("--")
ap = argparse.ArgumentParser()
ap.add_argument("--key", required=True)
ap.add_argument("--label")
ap.add_argument("--group")
ap.add_argument("--sid")
ap.add_argument("--feedback-id")
ap.add_argument("--priority", type=int, default=0)
ap.add_argument("--input", action="append", default=[])
ap.add_argument("--output", action="append", default=[])
ap.add_argument("--cpu", action="store_true")
a = ap.parse_args(argv[:i])
steps, cur = [], []
for x in argv[i + 1:]:
    if x == "--then":
        steps.append(cur); cur = []
    else:
        cur.append(x)
steps.append(cur)
if not all(steps):
    sys.exit("empty command")
spec = {"key": a.key, "steps": steps, "label": a.label, "group": a.group, "sid": a.sid, "feedback_id": a.feedback_id,
        "priority": a.priority, "inputs": a.input, "outputs": a.output, "gpu": not a.cpu}
req = urllib.request.Request(f"http://127.0.0.1:{vo_env.PORT}/api/queue", json.dumps({k: v for k, v in spec.items() if v is not None}).encode(),
                             {"Content-Type": "application/json"})
try:
    job = json.loads(urllib.request.urlopen(req, timeout=10).read())
except urllib.error.HTTPError as e:
    sys.exit(f"queue refused the job: {e.read().decode()}")
except OSError as e:
    sys.exit(f"review server not reachable on port {vo_env.PORT} ({e}); start it with npm run voiceover-server")
print(f"job #{job['id']} {job['status']}: {job['label']}" + (f" ({job['message']})" if job.get("message") else ""))
