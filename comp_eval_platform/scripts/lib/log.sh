# Harmonized system-level logging for node scripts. Source it, then use the three
# levels below so a reader can always tell what the *system* did from what a *tool*
# printed: every system line is bracketed `[LABEL | HH:MM:SS]`, tool output stays raw.
#
#   log_stage MSG   a major boundary — Start/End, "Running instance i/n".  '#' box
#   log_step  MSG   a system-invoked sub-step, e.g. one tool script.       '-' rule
#   log_info  MSG   a one-line system note (timings, verdicts, timeouts).  no rule
#
# LABEL comes from $COMP_LABEL (the competition, e.g. "VNN-COMP"); times are UTC.
: "${COMP_LABEL:=COMP-EVAL}"

_LOG_BAR='###############################################################'
_LOG_RULE='---------------------------------------------------------------'

_log_tag() { printf '[%s | %s]' "$COMP_LABEL" "$(date -u +%H:%M:%S)"; }

log_stage() { printf '\n%s\n%s %s\n%s\n' "$_LOG_BAR" "$(_log_tag)" "$*" "$_LOG_BAR"; }
log_step()  { printf '\n%s\n- %s %s\n' "$_LOG_RULE" "$(_log_tag)" "$*"; }
log_info()  { printf '%s %s\n' "$(_log_tag)" "$*"; }
