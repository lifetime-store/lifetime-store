This is a HOTFIX, not a full file replacement.

The last crawler-safe patch broke the mobile layout by moving the mobile account/cart row out of normal flow.

Do this:
1. Open your current file: public/assets/css/styles.css
2. Paste the CSS block from this patch at the VERY END of that file
3. Commit and redeploy

Do NOT replace your entire styles.css with this file alone.
