#!/bin/sh
# Generic tool install, shipped by core and reused by every variant.
#
# Clone a submitted tool onto the node and run its install_tool.sh, then report back.
# A tool ships install_tool.sh (once per node) plus prepare_instance.sh / run_instance.sh
# (per instance, driven later by the variant's run script) under ${script_dir}, each
# taking the interface version as their first argument. All three must exist, so this
# fails fast here rather than midway through a benchmark. The remote script POSTs the log
# tail to ${ROOT_URL}/update/${task_id}/success|failure, so the error is captured in the
# DB even after the node is torn down.
#
# Params (env, from the step handler): benchmark_ip task_id repository hash script_dir
# version run_as_root tool_dir. ROOT_URL comes from the backend environment. NODE_SSH_KEY
# locates the node key. COMP_LABEL / COMP_LOG_LIB (seeded by shell.py) drive the shared
# logging. tool_dir is where the tool is cloned (so the variant's run script finds it);
# defaults to "tool".
set -eu

ssh_key="${NODE_SSH_KEY:-$HOME/.ssh/vnncomp.pem}"
tool_dir="${tool_dir:-tool}"
log_lib="${COMP_LOG_LIB:-$(dirname "$0")/../lib/log.sh}"
node="ubuntu@${benchmark_ip}"
ssh_opts="-o StrictHostKeyChecking=accept-new -i ${ssh_key}"
remote_script_path="/home/ubuntu/install_tool_${task_id}.sh"
remote_log_path="/home/ubuntu/logs/install.log"

if [ "${run_as_root:-false}" = "true" ]; then sudo="sudo -E"; else sudo=""; fi

# Ship the shared logging helpers so the remote banners match every other stage.
ssh $ssh_opts "$node" "mkdir -p /home/ubuntu/logs"
scp $ssh_opts "${log_lib}" "${node}:/home/ubuntu/comp_log.sh"

ssh $ssh_opts "$node" \
    "cat > ${remote_script_path} <<'REMOTE_SCRIPT'
#!/bin/bash
export COMP_LABEL=\"${COMP_LABEL:-COMP-EVAL}\"
. /home/ubuntu/comp_log.sh
cd /home/ubuntu || exit 1
mkdir -p logs
exec > >(tee ${remote_log_path}) 2>&1
log_stage 'Start — installing tool'

report() {  # success|failure — POST the log tail so the error survives node teardown
    tail -c 200000 ${remote_log_path} > /tmp/install_${task_id}.tail 2>/dev/null || true
    curl --retry 100 --retry-connrefused --max-time 120 --data-binary @/tmp/install_${task_id}.tail ${ROOT_URL}/update/${task_id}/\$1 || true
    return 0
}

# Tools built against a conda base image (the AWS AMIs ship one) expect it on PATH;
# a no-op on a plain node without conda.
if [ -f /home/ubuntu/anaconda3/etc/profile.d/conda.sh ]; then
    . /home/ubuntu/anaconda3/etc/profile.d/conda.sh
else
    export PATH=\"/home/ubuntu/anaconda3/bin:\$PATH\"
fi

install_tool() {
    rm -rf ${tool_dir} || return 1
    log_run 'clone ${repository}' git clone ${repository} ${tool_dir} || return 1
    if [ -n \"${hash}\" ]; then git -C ${tool_dir} checkout ${hash} || return 1; fi
    cd ${tool_dir}/${script_dir} || return 1
    log_info 'checking the tool ships install_tool.sh, prepare_instance.sh, run_instance.sh'
    ls install_tool.sh prepare_instance.sh run_instance.sh || return 1
    chmod +x install_tool.sh prepare_instance.sh run_instance.sh
    log_run 'run install_tool.sh ${version}' ${sudo} /bin/bash install_tool.sh ${version}
}

if install_tool; then
    log_stage 'End — tool installed'
    report success
else
    log_stage 'End — tool installation FAILED'
    report failure
fi
REMOTE_SCRIPT
chmod +x ${remote_script_path}
tmux kill-session -t installation 2>/dev/null
tmux new-session -d -s installation /bin/bash ${remote_script_path}"
