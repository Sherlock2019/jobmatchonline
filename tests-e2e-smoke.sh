#!/usr/bin/env bash
# Production feature smoke test against the LIVE jobsmatchnow.com API + app.
B=https://jobsmatchnow.com
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "  PASS $1"; pass=$((pass+1)); else echo "  FAIL $1 (got: $2, want: $3)"; fail=$((fail+1)); fi; }
j() { curl -s -m 20 "$@"; }

echo "== 1. health / session / app shell =="
ck "api health ok" "$(j $B/api/health | jq -r .ok)" "true"
ck "session endpoint guards unauthenticated access (401)" "$(j $B/api/auth/session -o /dev/null -w "%{http_code}")" "401"
ck "app shell served" "$(j $B/ -o /dev/null -w '%{http_code}')" "200"
ck "login entry (linkedin oauth) redirects/answers" "$(curl -s -m 20 -o /dev/null -w '%{http_code}' $B/api/auth/linkedin)" "302"

echo "== 2. bootstrap: candidate + employer roles (registration-equivalent demo entry) =="
BOOT=$(j "$B/api/bootstrap?role=candidate")
ck "candidate bootstrap has viewer" "$(echo "$BOOT" | jq -r '.viewer.id')" "candidate-demo"
JOBS=$(echo "$BOOT" | jq '.jobs | length')
echo "  jobs available: $JOBS"; [ "${JOBS:-0}" -gt 0 ] && { echo "  PASS jobs list non-empty"; pass=$((pass+1)); } || { echo "  FAIL jobs empty"; fail=$((fail+1)); }
ck "jobs carry geolocation distance" "$(echo "$BOOT" | jq -r '.jobs[0] | has("distanceKm")')" "true"
ck "jobs carry explainable match score" "$(echo "$BOOT" | jq -r '.jobs[0].match | has("score")')" "true"
EBOOT=$(j "$B/api/bootstrap?role=employer")
ck "employer bootstrap has viewer" "$(echo "$EBOOT" | jq -r '.viewer.id')" "employer-demo"
CANDS=$(echo "$EBOOT" | jq '.candidates | length')
echo "  candidates available: $CANDS"

echo "== 3. swipe flow: pass, like, mutual match =="
JOB1=$(echo "$BOOT" | jq -r '.jobs[0].id'); JOB2=$(echo "$BOOT" | jq -r '.jobs[1].id')
P=$(j -X POST $B/api/swipes -H 'Content-Type: application/json' -d "{\"actorId\":\"candidate-demo\",\"targetId\":\"$JOB1\",\"targetType\":\"job\",\"direction\":\"pass\"}")
ck "pass swipe accepted" "$(echo "$P" | jq -r 'has("swipe")')" "true"
L=$(j -X POST $B/api/swipes -H 'Content-Type: application/json' -d "{\"actorId\":\"candidate-demo\",\"targetId\":\"$JOB2\",\"targetType\":\"job\",\"direction\":\"like\"}")
ck "like swipe accepted" "$(echo "$L" | jq -r 'has("swipe")')" "true"
# reciprocal: employer likes the candidate back -> mutual match
CAND=candidate-demo
R=$(j -X POST $B/api/swipes -H 'Content-Type: application/json' -d "{\"actorId\":\"employer-demo\",\"targetId\":\"$CAND\",\"targetType\":\"candidate\",\"direction\":\"like\"}")
echo "  reciprocal like result: $(echo "$R" | jq -c '{match: (.match != null), swipe: (.swipe != null)}')"
MATCHES=$(j "$B/api/bootstrap?role=candidate" | jq '.matches | length')
echo "  matches now: $MATCHES"; [ "${MATCHES:-0}" -gt 0 ] && { echo "  PASS mutual match exists"; pass=$((pass+1)); } || { echo "  FAIL no match"; fail=$((fail+1)); }

echo "== 4. chat on a match =="
MID=$(j "$B/api/bootstrap?role=candidate" | jq -r '.matches[0].id // empty')
if [ -n "$MID" ]; then
  M=$(j -X POST $B/api/messages -H 'Content-Type: application/json' -d "{\"matchId\":\"$MID\",\"senderId\":\"candidate-demo\",\"text\":\"Smoke test: coffee this week?\"}")
  ck "message sent on match" "$(echo "$M" | jq -r 'has("message") or has("id")')" "true"
else
  echo "  SKIP no match id"; fail=$((fail+1))
fi

echo "== 5. validation + abuse guards =="
ck "bad swipe rejected (unknown user)" "$(j -o /dev/null -w '%{http_code}' -X POST $B/api/swipes -H 'Content-Type: application/json' -d '{"actorId":"nobody","targetId":"x","targetType":"job","direction":"like"}')" "400"
ck "bad message rejected (unknown match)" "$(j -o /dev/null -w '%{http_code}' -X POST $B/api/messages -H 'Content-Type: application/json' -d '{"matchId":"nope","senderId":"candidate-demo","text":"hi"}')" "404"

echo "== 6. exact mockup + carousel shipped in app bundle =="
A=$(curl -s $B/ | grep -o 'src="[^"]*index[^"]*\.js"' | head -1 | sed 's/src="//;s/"$//')
BUN=$(curl -s "$B$A")
for m in "hero-phone.png" "Register free" "CANDIDATE PROFILE" "mutually matched"; do
  echo "$BUN" | grep -q "$m" && { echo "  PASS bundle has: $m"; pass=$((pass+1)); } || { echo "  FAIL bundle missing: $m"; fail=$((fail+1)); }
done

echo
echo "RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "PRODUCTION FEATURE SMOKE: ALL PASS" || echo "PRODUCTION FEATURE SMOKE: FAILURES PRESENT"
