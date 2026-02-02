# Plan Mode Feature

This extension adds a planning phase to your workflow.

## Usage

1. Type `/plan` or press `Ctrl+Alt+P` to enable Plan Mode.
2. Ask pi to perform a task.
3. Pi will generate a plan and show it to you.
4. You will be prompted with a menu:
   - **Execute the plan**: Full access is restored and pi starts working on the steps.
   - **Stay in plan mode**: Refine the task while remaining in read-only mode.
   - **Refine the plan**: Provide additional instructions to update the plan.

## How it works

- **Read-only**: When planning, pi can only read files and run safe bash commands.
- **Progress tracking**: During execution, pi uses `[DONE:n]` tags to track steps in the footer and a widget.
- **Safety**: No files are modified until you approve the plan.
