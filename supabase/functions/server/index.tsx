import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes
app.use(
  "/make-server-2914ec93/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check
app.get("/make-server-2914ec93/health", (c) => c.json({ status: "ok" }));

// Get all requests
app.get("/make-server-2914ec93/requests", async (c) => {
  try {
    const rawData = await kv.getByPrefix("req:");
    if (!rawData || !Array.isArray(rawData)) {
      return c.json({ success: true, data: [] });
    }

    const migrated = rawData
      .filter(item => item !== null)
      .map((req: any) => {
        if (req.comments !== undefined) return req;
        return {
          ...req,
          comments: req.note || req.requester ? [{
            commentId: req.id?.toString() || Date.now().toString(),
            note: req.note || "",
            requester: req.requester || "匿名",
            time: req.time || "刚刚",
            ownerId: req.ownerId || ""
          }] : [],
          createdAt: req.createdAt || req.id || Date.now()
        };
      })
      .filter((req: any) => req.comments && req.comments.length > 0);

    return c.json({ success: true, data: migrated });
  } catch (error: any) {
    console.error("Error getting requests:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add a request or comment
app.post("/make-server-2914ec93/requests", async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id;
    if (!id) return c.json({ success: false, error: "Missing track ID" }, 400);

    const key = `req:${id}`;
    let existing = await kv.get(key);

    if (existing) {
      existing.comments = existing.comments || [];
      if (body.comments && body.comments.length > 0) {
        const ownerId = body.comments[0].ownerId;
        if (ownerId && existing.comments.some((cmt: any) => cmt.ownerId === ownerId)) {
          return c.json({ success: false, error: "一个设备不能反复给一首歌评论或投票" }, 400);
        }
        existing.comments = [...body.comments, ...existing.comments];
      }
      existing.votes = existing.comments.length;
      await kv.set(key, existing);
      return c.json({ success: true, data: existing });
    } else {
      const reqData = { ...body };
      if (!reqData.comments) reqData.comments = [];
      reqData.createdAt = Date.now();
      reqData.votes = reqData.comments.length;
      await kv.set(key, reqData);
      return c.json({ success: true, data: reqData });
    }
  } catch (error: any) {
    console.error("Error adding request:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete a comment
app.delete("/make-server-2914ec93/requests/:id/comments/:commentId", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const ownerId = body.ownerId;
    const key = `req:${id}`;

    const reqData = await kv.get(key);
    if (!reqData) return c.json({ success: false, error: "Not found" }, 404);

    if (reqData.comments) {
      const originalLen = reqData.comments.length;
      reqData.comments = reqData.comments.filter((cmt: any) => !(cmt.commentId === commentId && cmt.ownerId === ownerId));
      if (reqData.comments.length === originalLen) {
        return c.json({ success: false, error: "Unauthorized or comment not found" }, 403);
      }
      reqData.votes = reqData.comments.length;
      if (reqData.votes === 0) {
        await kv.del(key);
        return c.json({ success: true, deleted: true });
      }
      await kv.set(key, reqData);
      return c.json({ success: true, data: reqData });
    }
    return c.json({ success: false, error: "No comments" }, 404);
  } catch (error: any) {
    console.error("Error deleting comment:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
