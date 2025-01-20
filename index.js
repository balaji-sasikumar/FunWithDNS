const dgram = require("dgram");
const dns = require("dns");

// DNS server settings
const PORT = 8053; // Custom DNS server port
const HOST = "127.0.0.1";

// Create a UDP socket
const server = dgram.createSocket("udp4");

// Handle errors
server.on("error", (err) => {
  console.error("Server error:", err);
  server.close();
});

// Log when the server starts listening
server.on("listening", () => {
  const address = server.address();
  console.log(`DNS server running at ${address.address}:${address.port}`);
});

// Parse DNS query
function parseQuery(message) {
  const query = message.slice(12);
  let domain = "";
  let offset = 0;

  while (query[offset] !== 0) {
    const length = query[offset];
    domain += query.slice(offset + 1, offset + 1 + length).toString() + ".";
    offset += length + 1;
  }

  return domain.slice(0, -1); // Remove trailing do`t
}

// Create DNS response
function createResponse(message, ip) {
  const transactionId = message.slice(0, 2); // Reuse transaction ID
  const flags = Buffer.from([0x81, 0x80]); // Standard query response, no error
  const questions = message.slice(4, 6); // Question count
  const answerCount = Buffer.from([0x00, 0x01]); // 1 Answer
  const authorityCount = Buffer.from([0x00, 0x00]); // No authority records
  const additionalCount = Buffer.from([0x00, 0x00]); // No additional records

  const domain = message.slice(12, message.indexOf(0x00, 12) + 1); // Extract domain name
  const typeAndClass = Buffer.from([0x00, 0x01, 0x00, 0x01]); // Type A, Class IN
  const ttl = Buffer.from([0x00, 0x00, 0x00, 0x3c]); // 60 seconds TTL
  const dataLength = Buffer.from([0x00, 0x04]); // 4 bytes for IPv4
  const ipBuffer = Buffer.from(ip.split(".").map(Number)); // Convert IP to buffer

  return Buffer.concat([
    transactionId,
    flags,
    questions,
    answerCount,
    authorityCount,
    additionalCount,
    domain,
    typeAndClass,
    typeAndClass,
    ttl,
    dataLength,
    ipBuffer,
  ]);
}

// Handle incoming messages
server.on("message", (message, rinfo) => {
  console.log(`Received DNS query from ${rinfo.address}:${rinfo.port}`);

  const domain = parseQuery(message);
  console.log(`Requested domain: ${domain}`);

  dns.resolve4(domain, (err, addresses) => {
    if (err) {
      console.error(`Failed to resolve domain: ${domain}`);
      return;
    }

    console.log(`Resolved ${domain} to ${addresses[0]}`);
    const response = createResponse(message, addresses[0]);
    server.send(response, rinfo.port, rinfo.address, () => {
      console.log(`Response sent to ${rinfo.address}:${rinfo.port}`);
    });
  });
});

// Start the DNS server
server.bind(PORT, HOST);
