## Start the app


### Option A: Running from inside `docs/docmd`
```
cd docs/docmd
npx @docmd/core dev
```

### Option B: Running from project root
If you prefer not to change directories back and forth in your terminal, use the `--cwd` (current working directory) override flag from your project root:
```
cd ..
npx @docmd/core dev --cwd docs/docmd
```