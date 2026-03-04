#!/usr/bin/env python3
"""DeviceRouter local launcher.

Usage:
    python launch.py

Presents an interactive menu to build, run examples, and manage Docker services.
Requires: Python 3.8+, pnpm, Docker (for Redis/observability options).

Docs: docs/getting-started.md
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

EXAMPLES = {
    "1": {
        "name": "Express",
        "dir": "examples/express-basic",
        "url": "http://localhost:3000",
        "doc": "docs/getting-started.md#quick-start--express",
    },
    "2": {
        "name": "Fastify",
        "dir": "examples/fastify-basic",
        "url": "http://localhost:3000",
        "doc": "docs/getting-started.md#quick-start--fastify",
    },
    "3": {
        "name": "Hono",
        "dir": "examples/hono-basic",
        "url": "http://localhost:3000",
        "doc": "docs/getting-started.md#quick-start--hono",
    },
    "4": {
        "name": "Koa",
        "dir": "examples/koa-basic",
        "url": "http://localhost:3000",
        "doc": "docs/getting-started.md#quick-start--koa",
    },
}


def run(cmd, cwd=ROOT):
    print(f"\n> {cmd}")
    subprocess.run(cmd, shell=True, cwd=cwd, check=True)


def header():
    print("\n╔══════════════════════════════════════════════╗")
    print("║         DeviceRouter Local Launcher          ║")
    print("╚══════════════════════════════════════════════╝\n")


def menu():
    header()
    print("  Build")
    print("  ─────")
    print("  b   Install deps & build all packages        (pnpm install && pnpm build)")
    print()
    print("  Examples  (MemoryStorage, no Docker needed)")
    print("  ────────")
    for key, ex in EXAMPLES.items():
        print(f"  {key}   {ex['name']:<12} {ex['url']:<30} {ex['doc']}")
    print()
    print("  Docker")
    print("  ──────")
    print("  r   Redis only                               (docker compose — express-basic)")
    print("  o   Observability stack                      (app + Redis + Prometheus + Grafana)")
    print("  d   Stop all Docker services")
    print()
    print("  Other")
    print("  ─────")
    print("  t   Run tests                                (pnpm test)")
    print("  l   Lint                                     (pnpm lint)")
    print("  q   Quit")
    print()


def build():
    run("pnpm install")
    run("pnpm build")
    print("\nBuild complete.")


def run_example(key):
    ex = EXAMPLES[key]
    example_dir = os.path.join(ROOT, ex["dir"])
    print(f"\nStarting {ex['name']} example...")
    print(f"Open {ex['url']} in your browser.")
    print(f"Docs: {ex['doc']}")
    print("Press Ctrl+C to stop.\n")
    try:
        run("pnpm dev", cwd=example_dir)
    except KeyboardInterrupt:
        print(f"\n{ex['name']} server stopped.")


def redis_up():
    compose_dir = os.path.join(ROOT, "examples/express-basic")
    run("docker compose up -d", cwd=compose_dir)
    print("\nRedis running on localhost:6379")
    print("Update your server.ts to use RedisStorageAdapter to connect.")


def observability_up():
    compose_dir = os.path.join(ROOT, "examples/observability")
    print("\nStarting observability stack (app + Redis + Prometheus + Grafana)...")
    print("  App:        http://localhost:3000")
    print("  Grafana:    http://localhost:3001  (admin/admin)")
    print("  Prometheus: http://localhost:9090")
    print("  Docs:       docs/observability.md")
    print("\nPress Ctrl+C to stop.\n")
    try:
        run("docker compose up", cwd=compose_dir)
    except KeyboardInterrupt:
        print("\nStopping observability stack...")
        run("docker compose down", cwd=compose_dir)


def docker_down():
    for d in ["examples/express-basic", "examples/observability"]:
        compose_dir = os.path.join(ROOT, d)
        compose_file = os.path.join(compose_dir, "docker-compose.yml")
        if os.path.exists(compose_file):
            run("docker compose down", cwd=compose_dir)
    print("\nAll Docker services stopped.")


def run_tests():
    run("pnpm test")


def lint():
    run("pnpm lint")


def main():
    if not os.path.exists(os.path.join(ROOT, "package.json")):
        print("Error: launch.py must be in the DeviceRouter repo root.")
        sys.exit(1)

    while True:
        menu()
        choice = input("  Choose an option: ").strip().lower()

        try:
            if choice == "b":
                build()
            elif choice in EXAMPLES:
                run_example(choice)
            elif choice == "r":
                redis_up()
            elif choice == "o":
                observability_up()
            elif choice == "d":
                docker_down()
            elif choice == "t":
                run_tests()
            elif choice == "l":
                lint()
            elif choice == "q":
                print("Bye!")
                break
            else:
                print(f"Unknown option: {choice}")
        except subprocess.CalledProcessError as e:
            print(f"\nCommand failed (exit {e.returncode}). Check output above.")
        except KeyboardInterrupt:
            print()

        input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()
