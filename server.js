app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running"
    });
});

app.get("/health1", (req, res) => {
    res.status(200).send("OK");
});
