import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `[${info.level.toUpperCase()}] ${info.timestamp}: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: "logs/app_%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

export default logger;
