CREATE TABLE `composio_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`toolkit_name` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`connected_at` integer,
	`metadata` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `composio_connections_clerk_user_id_toolkit_name_unique` ON `composio_connections` (`clerk_user_id`,`toolkit_name`);--> statement-breakpoint
CREATE TABLE `composio_enabled_toolkits` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`toolkit_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `composio_enabled_toolkits_clerk_user_id_toolkit_name_unique` ON `composio_enabled_toolkits` (`clerk_user_id`,`toolkit_name`);