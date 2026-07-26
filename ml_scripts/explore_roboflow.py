import sys
from roboflow import Roboflow

def explore(api_key: str):
    rf = Roboflow(api_key=api_key)
    print("Roboflow init successful.")
    
    try:
        ws = rf.workspace("bp-hmv6v")
        projects = ws.projects()
        print(f"Workspace 'bp-hmv6v' プロジェクト一覧 (件数: {len(projects)}):")
        for p in projects:
            print(f" - {p}")
    except Exception as e:
        print(f"Workspace error: {e}")

if __name__ == "__main__":
    explore("FeGfj4zCHN65sfUugDrV")
