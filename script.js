const axios = require('axios');

const NODEBB_URL = 'https://forum.example.com';
const API_TOKEN = 'YOUR NODEBB TOKEN HERE'; // Put your NodeBB API token there
const TARGET_CATEGORY_ID = 1;
const POLLING_INTERVAL = 10000; // update latency

let lastProcessedTimestamp = Date.now();


// Send to MC server

async function sendToMinecraft(message, topic, author) {
    try {
        const postData = {
            category: "Forum",
            title: topic.title || "No name",
            url: `${NODEBB_URL}/topic/${topic.slug || topic.tid}`,
            content: message, // Posted message
            author: author    // Author tag
        };

        await axios.post('http://localhost:8080/notify', postData, {  
		/*
		^^^^ Change the port if you want!! ^^^^
		*/
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Sent to Minecraft:", postData);
    } catch (err) {
        console.error("❌ Error sending to Minecraft:", err.message);
        console.error("Error:", err.stack);
    }
}

// Main functions

async function checkNewPosts() {
    try {
        console.log(`[${new Date().toLocaleTimeString()}] Listing target category: ${TARGET_CATEGORY_ID}...`);

        const response = await axios.get(`${NODEBB_URL}/api/category/${TARGET_CATEGORY_ID}`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });

        if (!response.data || !Array.isArray(response.data.topics)) {
            console.error("Error: API cant reach the target (topics).");
            return;
        }

        const topics = response.data.topics;
        console.log(`   ... got ${topics.length} topics from API.`);

        let newActivityFound = false;
        let latestTimestampInBatch = lastProcessedTimestamp;

        for (const topic of topics) {
            // Check the time of the last post
            if (topic.lastposttime > lastProcessedTimestamp) {
                newActivityFound = true;

                let username, content;

                
                if (topic.teaser && topic.teaser.content) {
                    // Teaser info
                    username = topic.teaser.user.username;
                    content = topic.teaser.content.replace(/<[^>]*>?/gm, ''); // Removes HTML
                } else {
                    // New post message
                    username = topic.user.username;
                    content = `created a new post: "${topic.title}"`;
                }

                // Get full post text
                const fullPostContent = await getFullPostContent(topic);
                content += `\n\n${fullPostContent}`;

                // Sends to Minecraft: content = post text, username = author
                await sendToMinecraft(content, topic, username);

                // Timestamp update
                if (topic.lastposttime > latestTimestampInBatch) {
                    latestTimestampInBatch = topic.lastposttime;
                }
            }
        }

        if (newActivityFound) {
            console.log("   ... got something! Updating timestamp.");
            lastProcessedTimestamp = latestTimestampInBatch;
        }

    } catch (error) {
        console.error("Critical Error in script:", error.message);
    }
}

async function getFullPostContent(topic) {
    try {
        const postResponse = await axios.get(`${NODEBB_URL}/api/topic/${topic.tid}`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });

        if (postResponse.data && postResponse.data.posts && postResponse.data.posts.length > 0) {
            const firstPost = postResponse.data.posts[0];
            return firstPost.content.replace(/<[^>]*>?/gm, ''); // Remove HTML
        }

        return "";
    } catch (error) {
        console.error("Error getting full text from post:", error.message);
        return "";
    }
}

console.log("NodeBB targer listener is online!");
checkNewPosts();
setInterval(checkNewPosts, POLLING_INTERVAL);