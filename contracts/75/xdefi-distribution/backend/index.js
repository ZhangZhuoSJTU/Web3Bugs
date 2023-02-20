const http = require("http");
const url = require('url');
const fs = require('fs');
const path = require('path');

const host = 'localhost';
const port = 8000;

const errorResponse = (res) => {
    res.writeHead(400);
    res.end()
};

const getImageUrl = (points) => {
    // TODO: returns correct name based on points.
    return `http://localhost:8000/images/sample.png`
};

const getMetadata = (tokenId) => {
    const points = tokenId >> 128n;

    return JSON.stringify({
        attributes: [
            { trait_type: 'score', value: points.toString() }
        ],
        description: "XDEFIDistribution Position.",
        external_url: `http://localhost:8000/${tokenId}`,
        image: getImageUrl(points),
        name: "XDEFIDistribution Position"
    });
};

const metadataResponse = (tokenIdParam, res) => {
    if (!tokenIdParam || !/^[0-9]+$/.test(tokenIdParam)) return errorResponse(res);

    const tokenId = BigInt(tokenIdParam);

    if (tokenId >= (2n ** 256n)) return errorResponse(res);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(getMetadata(tokenId));
};

const imageResponse = (imageName, res) => {
    const filePath = path.join(__dirname, `images/${imageName}`);

    console.log(`${filePath} exists: ${fs.existsSync(filePath)}`);

    fs.readFile(filePath, (err, content) => {
        if (err) return errorResponse(res);

        res.writeHead(200, { 'Content-type': 'image/png' });
        res.end(content);
    });
};

const requestListener = function (req, res) {
    const urlParts = url.parse(req.url, false).path.split('/');

    if (urlParts.length <= 1) return errorResponse(res);

    if (urlParts[1] === 'images' && urlParts.length === 3) return imageResponse(urlParts[2], res);

    if (urlParts.length === 2) return metadataResponse(urlParts[1], res);

    return errorResponse(res);
};

const server = http.createServer(requestListener);

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
