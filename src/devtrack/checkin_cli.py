
from devtrack.models.checkin import DeveloperCheckIn
from devtrack.storage.checkin_store import SQLiteCheckInStore


def main():
    print("\n=== DevTracker — Developer Check-in ===\n")

    project_name = input("Project name: ").strip()
    if not project_name:
        print("Project name cannot be empty.")
        return

    work_description = input("What are you working on? ").strip()
    if not work_description:
        print("Work description cannot be empty.")
        return

    category = input(
        "Category (Coding/Debugging/Testing/Research/Other): "
    ).strip()

    if not category:
        category = "Other"

    blocker = input("Any blockers? (Press Enter if none): ").strip()

    checkin = DeveloperCheckIn(
        project_name=project_name,
        work_description=work_description,
        category=category,
        blocker=blocker or None,
    )

    store = SQLiteCheckInStore()
    checkin_id = store.save(checkin)

    print("\nCheck-in saved successfully!")
    print(f"Check-in ID: {checkin_id}")
    print(f"Project: {checkin.project_name}")
    print(f"Category: {checkin.category}")
    print(f"Time: {checkin.created_at:%Y-%m-%d %H:%M:%S}")


if __name__ == "__main__":
    main()
