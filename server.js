server.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("🎲 Milad Game Server Started");
    console.log("PORT from Render:", process.env.PORT);
    console.log("Using PORT:", PORT);
    console.log("Host: 0.0.0.0");
    console.log("=================================");
});