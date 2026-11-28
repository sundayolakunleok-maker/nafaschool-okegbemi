import { createApp } from "./app.js";
import { pool, sql } from "./db.js";

const app = createApp({ pool, sql });
const port = process.env.PORT || 3000;

// Start server
app.listen(port, () => {
  console.log(`NafaSchool API server listening on port ${port}`);
});
