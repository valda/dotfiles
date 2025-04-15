#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import time
from pathlib import Path
import sys

CONFIG_DIR = Path.home() / ".config" / "wlr-profiles"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

def get_wlr_state():
    output = subprocess.check_output(["wlr-randr"], text=True).splitlines()
    monitors = []
    current_monitor = None

    def flush_monitor():
        if current_monitor:
            monitors.append(current_monitor.copy())

    for line in output:
        if not line.startswith(" "):  # 新しいモニタ
            flush_monitor()
            name = line.split()[0]
            current_monitor = {
                "name": name,
                "enabled": False,
                "mode": "",
                "pos": "",
                "scale": None,
                "transform": ""
            }
        elif match := re.search(r"Enabled:\s+(yes|no)", line):
            current_monitor["enabled"] = match.group(1) == "yes"
        elif "current" in line:
            res = line.strip().split()[0]
            current_monitor["mode"] = res
        elif match := re.search(r"Position:\s+(\d+),(\d+)", line):
            current_monitor["pos"] = f"{match.group(1)},{match.group(2)}"
        elif match := re.search(r"Scale:\s+([0-9.]+)", line):
            current_monitor["scale"] = float(match.group(1))
        elif match := re.search(r"Transform:\s+([a-zA-Z0-9_]+)", line):
            current_monitor["transform"] = match.group(1)
    flush_monitor()

    return monitors

def save_profile(profile: str, data):
    if profile:
        filepath = CONFIG_DIR / f"{profile}.json"
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved to {filepath}")
    else:
        json.dump(data, sys.stdout, indent=2)

def apply_profile(profile: str, state: str = None):
    filepath = CONFIG_DIR / f"{profile}.json"
    if not filepath.exists():
        print(f"Error: profile '{profile}' not found at {filepath}", file=sys.stderr)
        sys.exit(1)

    with open(filepath) as f:
        monitors = json.load(f)

    print(f"Applying profile: {profile}")

    for m in monitors:
        cmd = ["wlr-randr", "--output", m["name"]]
        if state == "on" or m["enabled"]:
            cmd += ["--on", "--mode", m["mode"], "--pos", m["pos"]]
            if m.get("scale") is not None:
                cmd += ["--scale", str(m["scale"])]
            if m.get("transform"):
                cmd += ["--transform", m["transform"]]
        else:
            cmd += ["--off"]

        print("Running:", " ".join(cmd))
        if subprocess.run(cmd).returncode != 0:
            print(f"\033[31m✗ Failed to set {m['name']}\033[0m")
        else:
            print(f"\033[32m✓ {m['name']} applied\033[0m")

def dpms_all(state: str):
    monitors = []
    output = subprocess.check_output(["wlr-randr"], text=True).splitlines()
    for line in output:
        if not line.startswith(" "):  # 新しいモニタ
            name = line.split()[0]
            monitors.append(name)

    for m in monitors:
        cmd = ["wlr-randr", "--output", m]
        if state == "on":
            cmd += ["--on"]
        else:
            cmd += ["--off"]

        print("Running:", " ".join(cmd))
        if subprocess.run(cmd).returncode != 0:
            print(f"\033[31m✗ Failed to set DPMS {state.upper()} on {m}\033[0m")
        else:
            print(f"\033[32m✓ DPMS {state.upper()} applied to {m}\033[0m")

def main():
    parser = argparse.ArgumentParser(description="Wayland monitor profile manager using wlr-randr")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dump", action="store_true", help="Dump current monitor config")
    group.add_argument("--apply", action="store_true", help="Apply monitor config")
    group.add_argument("--dpms", choices=["on", "off"], help="Turn on/off all monitors")
    parser.add_argument("--profile", type=str, help="Profile name (required for --apply and --dpms on)")

    args = parser.parse_args()

    if args.dump:
        state = get_wlr_state()
        save_profile(args.profile, state)
    elif args.apply:
        if not args.profile:
            parser.error("--apply requires --profile")
            exit(1)
        apply_profile(args.profile)
    elif args.dpms:
        if args.dpms == "on":
            if not args.profile:
                parser.error("--dpms on requires --profile")
                exit(1)
            dpms_all("on")
            time.sleep(0.5)
            apply_profile(args.profile, "on")
        else:
            dpms_all("off")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
