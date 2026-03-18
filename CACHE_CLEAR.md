# Browser Cache Clear Instructions

The KPI tier schema cache error might be caused by browser caching old queries. Follow these steps:

## 1. Hard Refresh (Chrome/Firefox/Edge)
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

## 2. Clear Browser Cache Completely
### Chrome:
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"

### Firefox:
1. Press `Ctrl + Shift + Delete`
2. Select "Cache" 
3. Click "Clear"

## 3. Clear Application Storage
1. Open Developer Tools (`F12`)
2. Go to **Application** tab
3. Expand **Local Storage** → **https://your-app-url.com**
4. Right-click and **Delete**
5. Expand **Session Storage** → **https://your-app-url.com**
6. Right-click and **Delete**

## 4. Restart Browser
Completely close and reopen your browser after clearing cache.

## 5. Test Again
Try accessing the KPI settings again. The error should be gone if it was a caching issue.

## 6. If Error Persists
The error might be coming from:
- Server-side caching in Supabase
- A different query source
- Multiple simultaneous calls

Check the browser console for the new debug messages to see exactly where the error occurs.
