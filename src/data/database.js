import { env, SQL } from "bun";

export class Database {
  static client = new SQL({
    url: env.DATABASE_URL,
    max: 10,
    idleTimeout: 30,
    maxLifetime: 0,
    connectionTimeout: 30,
    onconnect: () => {
      console.log(`Connected to ${env.DATABASE_URL}`);
    },
    onclose: () => {
      console.log(`Disconnected from ${env.DATABASE_URL}`);
    }
  });

  static {
    this.client.begin(async transaction => {
      await transaction`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          nickname VARCHAR(32) UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `;
      await transaction`
        CREATE TABLE IF NOT EXISTS user_sessions (
          user_id VARCHAR(36) REFERENCES users(id),
          id VARCHAR(64) NOT NULL,
          time INTEGER NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          iv VARCHAR(32) NOT NULL,
          auth_tag VARCHAR(32) NOT NULL,
          CONSTRAINT user_id_id PRIMARY KEY (user_id, id)
        )
      `;
    });
  }
}
