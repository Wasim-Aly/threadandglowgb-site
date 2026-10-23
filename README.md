# Thread & Glow GB

A static storefront for handmade crochet and Himalayan salt-lamp products from Gilgit-Baltistan. Product enquiries and orders are handled through WhatsApp.

## Run locally

Open `index.html` in a browser, or serve this folder with any static web server.

## Update products

Edit the product list in `js/script.js`. Set each product's `p` value to its price in PKR; leave it as `null` to show “Ask for price” and confirm the final price on WhatsApp.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Use the repository root as the Root Directory and choose **Other** as the Framework Preset.
4. This is a static site: leave the Build Command and Output Directory empty, then deploy.

Vercel will serve `index.html` from the project root and redeploy when changes are pushed to the connected branch.
