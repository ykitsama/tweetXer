// ==UserScript==
// @name         TweetXer
// @namespace    https://gist.github.com/lucahammer/a4d1e957ec9e061e3cccafcbed599e16/
// @version      0.5
// @description  Delete all your Tweets for free.
// @author       Luca
// @match        https://x.com/*
// @icon         https://www.google.com/s2/favicons?domain=x.com
// @grant        unsafeWindow
// ==/UserScript==

/*
 Copyright 2023 Nobody
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var TweetsXer = {
    allowed_requests: [],
    dId: "exportUpload",
    tIds: [],
    tId: "",
    ratelimitreset: 0,
    more: '[data-testid="tweet"] [aria-label="More"][data-testid="caret"]',
    skip: 0,
    total: 0,
    dCount: 0,
    lastHeaders: {},
    deleteURL: 'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
    unfavURL: 'https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet',
    username: '',
    action: '',
    bookmarksURL: 'https://x.com/i/api/graphql/sLg287PtRrRWcUciNGFufQ/Bookmarks?',
    bookmarks: [],
    bookmarksNext: '',

    init() {
        // document.querySelector('header>div>div').setAttribute('class', '')
        TweetsXer.username = document.location.href.split('/')[3]
        this.createUploadForm()
        TweetsXer.initXHR()
    },

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    },
    async waitForElemToExist(selector) {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector))
            }

            var observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector))
                    observer.disconnect()
                }
            })

            observer.observe(document.body, {
                subtree: true,
                childList: true,
            })
        })
    },

    initXHR() {
        if (typeof AjaxMonitoring_notfired == "undefined")
            var AjaxMonitoring_notfired = false
        if (!AjaxMonitoring_notfired) {
            AjaxMonitoring_notfired = true

            /* NOTE: XMLHttpRequest actions happen in this sequence: at first "open"[readyState=1] happens, then "setRequestHeader", then "send", then "open"[readyState=2] */

            var XHR_SendOriginal = XMLHttpRequest.prototype.send
            XMLHttpRequest.prototype.send = function () {
                XHR_SendOriginal.apply(this, arguments)
            }

            var XHR_OpenOriginal = XMLHttpRequest.prototype.open
            XMLHttpRequest.prototype.open = function () {
                if (arguments[1] && arguments[1].includes("DeleteTweet")) {
                    // POST /DeleteTweet
                    TweetsXer.deleteURL = arguments[1]
                }
                XHR_OpenOriginal.apply(this, arguments)
            }

            var XHR_SetRequestHeaderOriginal = XMLHttpRequest.prototype.setRequestHeader
            XMLHttpRequest.prototype.setRequestHeader = function (a, b) {
                TweetsXer.lastHeaders[a] = b
                XHR_SetRequestHeaderOriginal.apply(this, arguments)
            }
        }
    },

    updateProgressBar() {
        document.getElementById('progressbar').setAttribute('value', this.dCount)
        document.getElementById("info").textContent = `${this.dCount} deleted`
    },

    processFile() {
        let tn = document.getElementById(`${TweetsXer.dId}_file`)
        if (tn.files && tn.files[0]) {
            let fr = new FileReader()
            fr.onloadend = function (evt) {
                TweetsXer.skip = document.getElementById('skipCount').value
                console.log(`Skipping oldest ${TweetsXer.skip} Tweets`)

                // window.YTD.tweet_headers.part0
                // window.YTD.tweets.part0
                // window.YTD.like.part0
                let cutpoint = evt.target.result.indexOf('= ')
                let filestart = evt.target.result.slice(0, cutpoint)
                let json = JSON.parse(evt.target.result.slice(cutpoint + 1))

                if (filestart.includes('.tweet_headers.')) {
                    console.log('File contains Tweets.')
                    TweetsXer.action = 'untweet'
                    TweetsXer.tIds = json.map((x) => x.tweet.tweet_id)
                }
                else if (filestart.includes('.tweets.') || filestart.includes('.tweet.')) {
                    console.log('File contains Tweets.')
                    TweetsXer.action = 'untweet'
                    TweetsXer.tIds = json.map((x) => x.tweet.id_str)
                }
                else if (filestart.includes('.like.')) {
                    console.log('File contains Favs.')
                    TweetsXer.action = 'unfav'
                    TweetsXer.tIds = json.map((x) => x.like.tweetId)
                }
                else {
                    console.log('File contain not recognized. Please use a file from the Twitter data export.')
                }

                document
                    .querySelector('[data-testid="AppTabBar_Profile_Link"]')
                    .click()

                TweetsXer.total = TweetsXer.tIds.length
                document.getElementById('start').remove()
                TweetsXer.createProgressBar()

                if (TweetsXer.action == 'untweet') {
                    TweetsXer.tIds.reverse()
                    TweetsXer.tIds = TweetsXer.tIds.slice(TweetsXer.skip)
                    TweetsXer.dCount = TweetsXer.skip
                    TweetsXer.tIds.reverse()
                    document.getElementById(
                        `${TweetsXer.dId}_title`
                    ).textContent = `Deleting ${TweetsXer.total} Tweets`

                    TweetsXer.deleteTweets()
                }

                else if (TweetsXer.action == 'unfav') {
                    TweetsXer.tIds = TweetsXer.tIds.slice(TweetsXer.skip)
                    TweetsXer.dCount = TweetsXer.skip
                    TweetsXer.tIds.reverse()
                    document.getElementById(
                        `${TweetsXer.dId}_title`
                    ).textContent = `Deleting ${TweetsXer.total} Favs`
                    TweetsXer.deleteFavs()
                }

                else {
                    document.getElementById(
                        `${TweetsXer.dId}_title`
                    ).textContent = `Please try a different file`
                }



            }
            fr.readAsText(tn.files[0])
        }
    },

    createUploadForm() {
        var h2_class = document.querySelectorAll("h2")[1]?.getAttribute("class") || ""
        var div = document.createElement("div")
        div.id = this.dId
        if (document.getElementById(this.dId))
            document.getElementById(this.dId).remove()
        div.innerHTML = `<style>#${this.dId}{ z-index:99999; position: sticky; top:0px; left:0px; width:auto; margin:0 auto; padding: 20px 10%; background:#87CEFA; opacity:0.9; } #${this.dId} > *{padding:5px;}</style>
        <div>
            <h2 class="${h2_class}" id="${this.dId}_title">TweetXer</h2>
            <p id="info">Select your tweet-headers.js from your Twitter Data Export to start the deletion of all your Tweets. </p>
        <p id="start">
          <input type="file" value="" id="${this.dId}_file"  />
          <a href="#" id="toggleAdvanced">Advanced Options</a>
          <div id="advanced" style="display:none">
          <label for="skipCount">Enter how many Tweets to skip (useful for reruns) before selecting a file.</label>
          <input id="skipCount" type="number" value="0" />
          
          <p>To delete your Favs (aka Likes), select your like.js file.</p>
          <p>Instead of your tweet-headers.js file, you can use the tweets.js file. Unfaving is limited to 500 unfavs per 15 minutes.</p>
          <input id="exportBookmarks" type="button" value="Export Bookmarks" />
          </div>
        </p>
        </div>`
        document.body.insertBefore(div, document.body.firstChild)
        document.getElementById("toggleAdvanced").addEventListener("click", (() => { let adv = document.getElementById('advanced'); if (adv.style.display == 'none') { adv.style.display = 'block' } else { adv.style.display = 'none' } }));
        document.getElementById(`${this.dId}_file`).addEventListener("change", this.processFile, false);
        document.getElementById("exportBookmarks").addEventListener("click", this.exportBookmarks, false);

    },

    async exportBookmarks() {
        //document.getElementById('exportBookmarks').remove()
        //TweetsXer.createProgressBar()
        while (!('authorization' in TweetsXer.lastHeaders)) {
            await TweetsXer.sleep(1000)
        }
        let variables = ''
        while (TweetsXer.bookmarksNext.length > 0 || TweetsXer.bookmarks.length == 0) {
            if (TweetsXer.bookmarksNext.length > 0) {
                variables = `{"count":20,"cursor":"${TweetsXer.bookmarksNext}","includePromotedContent":true}`
            }
            else variables = '{"count":20,"includePromotedContent":false}'
            let response = await fetch(TweetsXer.bookmarksURL + new URLSearchParams({
                variables: variables,
                features: '{"graphql_timeline_v2_bookmark_timeline":true,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"responsive_web_home_pinned_timelines_enabled":true,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"tweetypie_unmention_optimization_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_media_download_video_enabled":false,"responsive_web_enhance_cards_enabled":false}'
            }), {
                "headers": {
                    "accept": "*/*",
                    "accept-language": 'en-US,en;q=0.5',
                    "authorization": TweetsXer.lastHeaders.authorization,
                    "content-type": "application/json",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-client-transaction-id": TweetsXer.lastHeaders['X-Client-Transaction-Id'],
                    "x-client-uuid": TweetsXer.lastHeaders['x-client-uuid'],
                    "x-csrf-token": TweetsXer.lastHeaders['x-csrf-token'],
                    "x-twitter-active-user": "yes",
                    "x-twitter-auth-type": "OAuth2Session",
                    "x-twitter-client-language": 'en'
                },
                "referrer": 'https://x.com/i/bookmarks',
                "referrerPolicy": "strict-origin-when-cross-origin",
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            })

            if (response.status == 200) {
                let data = await response.json();
                data.data.bookmark_timeline_v2.timeline.instructions[0].entries.forEach((item) => {
                    
                    if (item.entryId.includes('tweet')) {
                        TweetsXer.dCount++
                        TweetsXer.bookmarks.push(item.content.itemContent.tweet_results.result)
                    }
                    else if (item.entryId.includes('cursor-bottom')) {
                        if (TweetsXer.bookmarksNext != item.content.value) { TweetsXer.bookmarksNext = item.content.value }
                        else { TweetsXer.bookmarksNext = '' }
                    }
                })
                console.log(TweetsXer.bookmarks)
                //document.getElementById('progressbar').setAttribute('value', TweetsXer.dCount)
                document.getElementById("info").textContent = `${TweetsXer.dCount} Bookmarks collected`
            }
            else {
                console.log(response)
            }

            if (response.headers.get('x-rate-limit-remaining') < 1) {
                console.log('rate limit hit')
                let ratelimitreset = response.headers.get('x-rate-limit-reset')
                let sleeptime = ratelimitreset - Math.floor(Date.now() / 1000)
                while (sleeptime > 0) {
                    sleeptime = ratelimitreset - Math.floor(Date.now() / 1000)
                    document.getElementById("info").textContent = `Ratelimited. Waiting ${sleeptime} seconds. ${TweetsXer.dCount} deleted.`
                    await TweetsXer.sleep(1000)
                }
            }
        }
        let download = new Blob([JSON.stringify(TweetsXer.bookmarks)], { type: 'text/plain' });
        let bookmarksDownload = document.createElement("a")
        bookmarksDownload.id = 'bookmarksDownload'
        bookmarksDownload.innerText = 'Download'
        bookmarksDownload.href = window.URL.createObjectURL(download);
        bookmarksDownload.download = 'twitter-bookmarks.json';
        document.getElementById('advanced').appendChild(bookmarksDownload)
    },

    createProgressBar() {
        let progressbar = document.createElement("progress")
        progressbar.setAttribute('id', "progressbar")
        progressbar.setAttribute('value', this.dCount)
        progressbar.setAttribute('max', this.total)
        progressbar.setAttribute('style', 'width:100%')
        document.getElementById(this.dId).appendChild(progressbar)
    },

    async deleteFavs() {
        // 500 unfavs per 15 Minutes
        // x-rate-limit-remaining
        // x-rate-limit-reset
        while (!('authorization' in this.lastHeaders)) {
            await this.sleep(1000)
        }
        TweetsXer.username = document.location.href.split('/')[3]

        while (this.tIds.length > 0) {
            this.tId = this.tIds.pop()
            let response = await fetch(this.unfavURL, {
                "headers": {
                    "accept": "*/*",
                    "accept-language": 'en-US,en;q=0.5',
                    "authorization": this.lastHeaders.authorization,
                    "content-type": "application/json",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-client-transaction-id": this.lastHeaders['X-Client-Transaction-Id'],
                    "x-client-uuid": this.lastHeaders['x-client-uuid'],
                    "x-csrf-token": this.lastHeaders['x-csrf-token'],
                    "x-twitter-active-user": "yes",
                    "x-twitter-auth-type": "OAuth2Session",
                    "x-twitter-client-language": 'en'
                },
                "referrer": `https://x.com/${this.username}/likes`,
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": `{\"variables\":{\"tweet_id\":\"${this.tId}\"},\"queryId\":\"${this.unfavURL.split('/')[6]}\"}`,
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            })

            if (response.status == 200) {
                TweetsXer.dCount++
                TweetsXer.updateProgressBar()
            }
            else {
                console.log(response)
            }

            if (response.headers.get('x-rate-limit-remaining') < 1) {
                console.log('rate limit hit')
                let ratelimitreset = response.headers.get('x-rate-limit-reset')
                let sleeptime = ratelimitreset - Math.floor(Date.now() / 1000)
                while (sleeptime > 0) {
                    sleeptime = ratelimitreset - Math.floor(Date.now() / 1000)
                    document.getElementById("info").textContent = `Ratelimited. Waiting ${sleeptime} seconds. ${TweetsXer.dCount} deleted.`
                    await this.sleep(1000)
                }
            }
        }
    },

    async deleteTweets() {
        while (!('authorization' in this.lastHeaders)) {
            await this.sleep(1000)
        }
        TweetsXer.username = document.location.href.split('/')[3]

        while (this.tIds.length > 0) {
            this.tId = this.tIds.pop()
            let response = await fetch(this.deleteURL, {
                "headers": {
                    "accept": "*/*",
                    "accept-language": 'en-US,en;q=0.5',
                    "authorization": this.lastHeaders.authorization,
                    "content-type": "application/json",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-client-transaction-id": this.lastHeaders['X-Client-Transaction-Id'],
                    "x-client-uuid": this.lastHeaders['x-client-uuid'],
                    "x-csrf-token": this.lastHeaders['x-csrf-token'],
                    "x-twitter-active-user": "yes",
                    "x-twitter-auth-type": "OAuth2Session",
                    "x-twitter-client-language": 'en'
                },
                "referrer": `https://x.com/${this.username}/with_replies`,
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": `{\"variables\":{\"tweet_id\":\"${this.tId}\",\"dark_request\":false},\"queryId\":\"${this.deleteURL.split('/')[6]}\"}`,
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            })
            if (response.status == 200) {
                TweetsXer.dCount++
                TweetsXer.updateProgressBar()
            }
            else {
                console.log(response)
            }
        }
    },

}

window.addEventListener('load', function () {
    // necessary when used as a userscript
    TweetsXer.init()
}, false)

TweetsXer.init()
