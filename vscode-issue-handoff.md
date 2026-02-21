VS Code Extension Issues - Complete Summary
Issue 1: pass:data with imports still flagged (header.html:42-45)
Current behavior: Shows error "Imports in bundled scripts require type="module"" Expected: Should NOT flag pass:data scripts - Vite handles bundling automatically Location: diagnostics.ts lines 243-246

The code has !\bpass:data\b exclusion but it's still triggering. Need to debug why.

Issue 2: Commented scripts still triggering diagnostics (header.html:47-50)
Current behavior: Shows "'allCaps' is declared multiple times (as 'import' and 'import')" Expected: Should NOT flag anything inside <!-- --> Location: analyzer.ts - isInsideHtmlComment() function

The problem: The function checks if scriptMatch.index is inside a comment range. But when the SCRIPT REGEX runs, it finds <script> inside the comment and tries to process it. The check needs to happen BEFORE the script is processed.

Issue 3: is:inline warning may not be showing (home.html:24-28)
Current behavior: The <script is:inline> with import (no type="module") may not be triggering a warning Expected: Should show error "Imports in <script is:inline> require type="module" attribute." Location: diagnostics.ts lines 224-242

Likely cause: The logic has two conditions that need to both be true:

Script has is:inline attribute: /\bis:inline\b/.test(attrs)
Script is NOT in <head>: !this.isInHead(text, tagStart)
If either condition fails, no warning is shown. The isInHead check may be incorrectly categorizing the script position.

Debugging Plan
Fix comment handling in analyzer.ts:
The isInsideHtmlComment check exists but IMPORT_REGEX still processes commented scripts
Need to ensure the check prevents import processing entirely, not just skip script tags
Fix pass:data exclusion:
Add debug logging to trace which condition is failing
Verify the regex !\bpass:data\b is actually excluding these scripts
Fix is:inline detection:
Verify the isInHead logic is working correctly
Check if the condition order is causing early returns