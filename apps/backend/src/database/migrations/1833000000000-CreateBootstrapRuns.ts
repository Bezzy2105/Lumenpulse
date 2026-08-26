import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bootstrap_runs', (table) => {
    table.string('id').primary();
    table.string('identifier').notNullable().unique();
    table.jsonb('resources').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('bootstrap_runs');
}