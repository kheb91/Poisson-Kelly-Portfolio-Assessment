# summarize_project.py
import os
import datetime

# --- Configuration ---
# The name of the output file.
OUTPUT_FILENAME = "project_summary.txt"

# Directories to completely ignore.
IGNORE_DIRS = {
    "__pycache__",
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "dist",
    "build"
}

# Files to ignore by name or extension.
IGNORE_FILES = {
    ".DS_Store",
    "package-lock.json",
    ".env",
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    OUTPUT_FILENAME
}

# --- Main Script Logic ---

def generate_structure_tree(root_dir, file_handle):
    """Walks through the directory and writes a visual tree structure."""
    file_handle.write("Project Folder Structure\n")
    file_handle.write("========================\n\n")

    for root, dirs, files in os.walk(root_dir, topdown=True):
        # Filter out ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        level = root.replace(root_dir, '').count(os.sep)
        indent = ' ' * 4 * (level)
        file_handle.write(f"{indent}{os.path.basename(root)}/\n")
        
        sub_indent = ' ' * 4 * (level + 1)
        for f in sorted(files):
            if f not in IGNORE_FILES:
                file_handle.write(f"{sub_indent}{f}\n")

def concatenate_file_contents(root_dir, file_handle):
    """Walks through the directory and appends the content of each relevant file."""
    file_handle.write("\n\nFile Contents\n")
    file_handle.write("========================\n")

    for root, dirs, files in os.walk(root_dir, topdown=True):
        # Filter out ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for f in sorted(files):
            if f in IGNORE_FILES:
                continue

            file_path = os.path.join(root, f)
            relative_path = os.path.relpath(file_path, root_dir)

            file_handle.write("\n\n" + "="*5 + f" FILE: {relative_path} " + "="*5 + "\n\n")

            try:
                with open(file_path, 'r', encoding='utf-8') as code_file:
                    file_handle.write(code_file.read())
            except Exception as e:
                file_handle.write(f"[Could not read file: {e}]")


def main():
    """Main function to generate the project summary."""
    project_root = os.getcwd()
    print(f"Starting project summary generation in: {project_root}")
    
    with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as summary_file:
        # Write the header
        summary_file.write("ScamScore Platform - Project Code Summary\n")
        summary_file.write(f"Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        summary_file.write("="*40 + "\n\n")

        # Generate the structure tree
        generate_structure_tree(project_root, summary_file)

        # Concatenate all file contents
        concatenate_file_contents(project_root, summary_file)

    print(f"\nSuccessfully created '{OUTPUT_FILENAME}'.")
    print("Please provide the contents of this file for the final code review.")

if __name__ == "__main__":
    main()