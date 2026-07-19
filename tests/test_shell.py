"""Node-script resolution: a plugin script wins, else core's shared copy is used."""
import os

from comp_eval_platform.compute import shell


def test_path_falls_back_to_core_script(monkeypatch, tmp_path):
    # A plugin (SCRIPT_ROOT) that ships no scripts/node/install_tool.sh gets core's.
    monkeypatch.setenv("SCRIPT_ROOT", str(tmp_path))
    resolved = shell._path("node", "install_tool.sh")
    assert resolved == os.path.join(shell._core_script_root(), "node", "install_tool.sh")
    assert os.path.isfile(resolved)


def test_path_prefers_the_plugin_script(monkeypatch, tmp_path):
    plugin = tmp_path / "scripts" / "node" / "install_tool.sh"
    plugin.parent.mkdir(parents=True)
    plugin.write_text("#!/bin/sh\n")
    monkeypatch.setenv("SCRIPT_ROOT", str(tmp_path))
    assert shell._path("node", "install_tool.sh") == str(plugin)
