import express, { type Application, type ErrorRequestHandler } from "express";
import * as Sentry from "@sentry/node";
import { proxyrouter } from "./routes/proxyRoutes";
import { promptRouter } from "./routes/promptRoutes";
import { userRouter } from "./routes/userRoutes";
import { chatRouter } from "./routes/chatRoutes";
import { webhookRouter } from "./routes/webhookRoutes";
import { versioningRouter } from "./routes/versioningRoutes";
import { governanceRouter } from "./routes/governanceRoutes"; // Issue #113
import searchRouter from "./routes/searchRoutes";
import { fulfillmentRouter } from "./routes/fulfillmentRoutes";
import { reviewRouter } from "./routes/reviewRoutes";
import { notificationRouter } from "./routes/notificationRoutes";
import { adminRateLimitRouter } from "./routes/adminRateLimitRoutes";
import { supportAccessRouter } from "./routes/supportAccessRoutes";
import { payoutLedgerRouter } from "./routes/payoutLedgerRoutes";
import { entitlementRouter } from "./routes/entitlementRoutes";
import { bundleRouter } from "./routes/bundleRoutes";
import {
  GetOpenApiSchema,
  GetOpenApiExplorer,
} from "./controllers/docsControllers";
import { runBackup, getBackupHealth } from "./services/backupService.js";
import { IndexerState } from "./models/IndexerState";
import { startIndexer } from "./services/indexer";
import { correlationMiddleware } from "./middleware/correlation";
import { errorHandlerMiddleware } from "./middleware/errorHandler";
import { runDataIntegrityCheck } from "./services/dataIntegrityMonitor";
import {
  runUserExport,
  listUserExports,
  cleanupExpiredExports,
  verifyExportChecksum,
  EXPORT_SCOPES,
  EXPORT_RETENTION_MS,
} from "./services/exportService";

const app = express();

const port = 5000;

// Sentry error handler should be registered after routes (#332).
app.use(express.json());

app.use("/api/improve-proxy", proxyrouter);
app.use("/api/prompts", promptRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/versions", versioningRouter);
app.use("/api/governance", governanceRouter); // Issue #113
app.use("/api/search", searchRouter);
app.use("/api/fulfillment", fulfillmentRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/notifications", authLimiter, notificationRouter);
app.use("/api/admin/rate-limits", adminRateLimitRouter);
app.use("/api/admin/support-access", supportAccessRouter);
app.use("/api/payouts", payoutLedgerRouter);
app.use("/api/entitlements", entitlementRouter);
app.use("/api/bundles", bundleRouter);

// Machine-readable API schema + interactive explorer (#713).
app.get("/api/openapi.json", GetOpenApiSchema);
app.get("/api/docs", GetOpenApiExplorer);

app.get("/health", async (req, res) => {
  const [state, backupHealth] = await Promise.all([
    IndexerState.findOne({ key: "prompt_hash_contract" }),
    getBackupHealth(),
  ]);
  res.json({
    status: "ok",
    indexer: {
      lastProcessedLedger: state?.lastIndexedLedger || 0,
      timestamp: new Date(),
    },
    backup: backupHealth,
  });
});

// Run data integrity check endpoint (admin only)
app.post("/api/admin/integrity-check", async (req, res) => {
  try {
    const report = await runDataIntegrityCheck();
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ error: "Failed to run integrity check" });
  }
});

// Sentry error handler must be registered after all routes (#332).
// expressErrorHandler is available in @sentry/node v7; v8+ uses setupExpressErrorHandler.
if (process.env.SENTRY_DSN) {
  if (
    typeof (Sentry as Record<string, unknown>).setupExpressErrorHandler ===
    "function"
  ) {
    (
      Sentry as unknown as {
        setupExpressErrorHandler: (app: Application) => void;
      }
    ).setupExpressErrorHandler(app);
  } else if (
    typeof (Sentry as Record<string, unknown>).expressErrorHandler ===
    "function"
  ) {
    app.use(
      (
        Sentry as unknown as {
          expressErrorHandler: () => ErrorRequestHandler;
        }
      ).expressErrorHandler(),
    );
  }
}

app.listen(port, () => {
  startIndexer().catch((err) => {
    console.error("Failed to start Soroban Indexer:", err);
  });
  startIndexer().catch((err) => {
    console.error("Failed to start Soroban Indexer:", err);
  });
});

export default app;
