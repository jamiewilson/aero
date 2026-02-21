# Git History Best Practices

A clean, readable git history makes generating changelogs trivial and helps collaborators understand the evolution of your project.

## Write Commit Messages for Changelogs

### Use Imperative Mood

Write commits as if you're commanding what the code should do. This aligns with how changelogs describe changes.

```
# Good
Add pass:data directive for server-to-client data threading

# Bad
Added pass:data directive
Adding the pass:data feature
```

### Start with a Verb

Begin commit messages with a present-tense verb:
- **Add** - New features
- **Fix** - Bug fixes
- **Change** / **Update** - Modifications to existing functionality
- **Remove** - Deletions
- **Refactor** - Code restructuring without behavior change
- **Deprecate** - Marking for future removal

### Be Specific, Not Verbose

Include enough detail to understand the change, but keep it concise:

```
# Good
Add pass:data to scripts and styles

# Bad
WIP
stuff
fixes
```

## Avoid Common Pitfalls

### Don't Use WIP/SF prefixes

```
# Bad
WIP: more stuff
SF: fixing things
```

### Don't Omit Descriptions

Empty or one-word commits provide no value:

```
# Bad
Merge branch 'feature/foo'

# Better
Merge branch 'feature/foo' into main
```

### Fix Typos Before Committing

```
# Bad
mirgrates to `is:` syntax

# Good
migrate to `is:` syntax
```

## Structure Your History

### Group Related Changes

Multiple small commits for the same feature can be squashed:

```
# Instead of
Add pass:data to scripts
Add pass:data to styles
Add docs for pass:data

# Use
Add pass:data directive for scripts and styles
```

### Separate Concerns

Keep orthogonal changes in separate commits:

```
# Good commits
Add image optimization
Refactor Vite config handling
Fix inline script placement
```

### Use Feature Branches

Work on features in branches, then merge when ready:

```
feature/new-diagnostics
bugfix/hmr-invalidation
refactor/script-taxonomy
```

## Link to Issues and PRs

Include references when relevant:

```
Fix pass:data for bundled scripts (#46)

# or with more context
Add image optimization with sharp compression (closes #27)
```

## Changelog-Friendly Commit Checklist

Before committing, ask:

1. Does the message use imperative mood?
2. Does it start with a verb?
3. Is it specific but concise?
4. Would it make sense in a changelog?
5. Are there typos?

## Generating Changelogs

With good commit messages, you can generate changelogs automatically:

```bash
# List commits since last tag
git log --oneline v1.0.0..HEAD

# Filter to meaningful changes (exclude merges, docs-only)
git log --oneline --grep="Add\|Fix\|Change\|Remove\|Refactor" v1.0.0..HEAD
```

The Common Changelog format expects imperative mood messages—this makes the transition from commit to changelog entry seamless.
