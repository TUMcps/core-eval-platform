# Harmonized system-level logging for node scripts. Source it, then use the helpers
# below so a reader can always tell what the *system* did from what a *tool* printed.
# Every system line carries `LABEL · HH:MM:SS`; a tool's own output is walled inside a
# thin box (each line prefixed `│ `) so a noisy install can't break the layout.
#
#   log_stage      MSG        a major boundary — Start/End of a stage.     thick box
#   log_superstage MSG        an OUTER boundary wrapping sub-stages        double box
#                             (only where a stage nests others, e.g. a
#                             benchmark that runs many instances). Reach for
#                             this tier only when needed; otherwise the two
#                             below (thick stage, thin box) are the palette.
#   log_info       MSG        a one-line system note (timings, verdicts).  tagged line
#   log_step       MSG        a lightweight sub-step divider.              thin rule
#   log_run        MSG CMD...   run CMD with its output walled in a thin box. thin box
#
# For finer control (a command whose exit code the caller inspects itself) the thin-box
# primitives log_run is built from are also exported:
#   log_box_open MSG   ┌── + the tagged MSG line
#   log_wall           stdin filter: prefixes every line with the box wall `│ `
#   log_box_note MSG   a tagged note line inside the box (e.g. the verdict)
#   log_box_close      └──
#
# LABEL comes from $COMP_LABEL (the competition, e.g. "VNN-COMP"); times are UTC.
: "${COMP_LABEL:=COMP-EVAL}"

_log_repeat() {  # COUNT CHAR — CHAR repeated COUNT times, so the bars can't miscount
    _n=$1; _s=''
    while [ "$_n" -gt 0 ]; do _s="${_s}$2"; _n=$((_n - 1)); done
    printf '%s' "$_s"
}
# Widths inset by tier in even 2-char steps (double longest → thin shortest) so the
# nesting reads at a glance.
_LOG_DOUBLE="$(_log_repeat 62 ═)"
_LOG_THICK="$(_log_repeat 60 ━)"
_LOG_THIN="$(_log_repeat 58 ─)"

_log_tag() { printf '%s · %s' "$COMP_LABEL" "$(date -u +%H:%M:%S)"; }

log_superstage() { printf '\n╔%s\n║ %s · %s\n╚%s\n' "$_LOG_DOUBLE" "$(_log_tag)" "$*" "$_LOG_DOUBLE"; }
log_stage()      { printf '\n┏%s\n┃ %s · %s\n┗%s\n' "$_LOG_THICK" "$(_log_tag)" "$*" "$_LOG_THICK"; }
log_step()       { printf '\n%s\n%s · %s\n' "$_LOG_THIN" "$(_log_tag)" "$*"; }
log_info()       { printf '%s · %s\n' "$(_log_tag)" "$*"; }

# --- thin box: wall a tool's output so it can't break the layout -------------
log_box_open()  { printf '┌%s\n│ %s · %s\n' "$_LOG_THIN" "$(_log_tag)" "$*"; }
log_box_note()  { printf '│ %s · %s\n' "$(_log_tag)" "$*"; }
log_box_close() { printf '└%s\n' "$_LOG_THIN"; }
# Prefix each line of stdin with the wall; flush per line so live logs still stream.
log_wall() { awk '{ print "│ " $0; fflush() }'; }

# Run CMD... with stdout+stderr walled inside a thin box, then a note with its exit
# code and wall-clock. Returns CMD's real status (captured past the pipe via a temp
# file, so it works the same in POSIX sh and bash — no PIPESTATUS needed).
log_run() {
    _msg=$1; shift
    log_box_open "$_msg"
    _rc_file="$(mktemp)"; _t0="$(date +%s)"
    { "$@" 2>&1; echo $? >"$_rc_file"; } | log_wall
    _rc="$(cat "$_rc_file")"; rm -f "$_rc_file"
    log_box_note "exited ${_rc} in $(( $(date +%s) - _t0 ))s"
    log_box_close
    return "${_rc:-1}"
}
