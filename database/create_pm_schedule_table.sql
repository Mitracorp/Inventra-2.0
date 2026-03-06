-- Create table to store custom PM schedule dates
CREATE TABLE IF NOT EXISTS PM_SCHEDULE (
  Schedule_ID INT AUTO_INCREMENT PRIMARY KEY,
  Project_ID INT NOT NULL,
  Scheduled_Date DATE NOT NULL,
  Is_Custom BOOLEAN DEFAULT TRUE,
  Notes TEXT,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (Project_ID) REFERENCES PROJECT(Project_ID) ON DELETE CASCADE,
  UNIQUE KEY unique_project_date (Project_ID, Scheduled_Date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index for faster queries
CREATE INDEX idx_project_date ON PM_SCHEDULE(Project_ID, Scheduled_Date);
