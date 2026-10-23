# Thread & Glow GB

A static storefront for handmade crochet and Himalayan salt-lamp products from Gilgit-Baltistan. Customers can contact the store through WhatsApp or email at threadandglow.gb@gmail.com.

## Run locally

Open `index.html` in a browser, or serve this folder with any static web server.

## Update products

Edit the product list in `js/script.js`. Set each product's `p` value to its price in PKR; leave it as `null` to show “Ask for price” and confirm the final price on WhatsApp.

## Customer messages

The cart collects a customer's name and city, then opens a pre-filled order request in WhatsApp or the customer's email app. The customer must review and send that draft; the static website does not receive or automatically reply to incoming messages. To send automatic greetings or away replies in WhatsApp, configure those in the WhatsApp Business app. A fully automated website-side reply requires a secure server and a messaging provider integration; never place provider access tokens in this static site's JavaScript.

Suggested WhatsApp Business greeting:

> Assalamualaikum! Thank you for contacting Thread & Glow GB. We’ve received your message and will get back to you as soon as possible. For order requests, we’ll confirm product availability, final price, delivery and payment before your order is confirmed.

Add it in WhatsApp Business under **Business tools → Greeting message**. An away message can be configured separately for times when you’re unavailable.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Use the repository root as the Root Directory and choose **Other** as the Framework Preset.
4. This is a static site: leave the Build Command and Output Directory empty, then deploy.

Vercel will serve `index.html` from the project root and redeploy when changes are pushed to the connected branch.
