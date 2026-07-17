import { action } from '@uibakery/data';

function listBatches() {
  return action('listBatches', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        pb.id, pb.batch_number, pb.product_id, pb.factory_id,
        pb.manufacture_date, pb.quantity_produced, pb.net_content_mg, pb.cost_override,
        pb.qc_status, pb.coa_url, pb.overall_purity_pct, pb.notes,
        p.sku, p.name AS product_name, p.standard_cost,
        f.name AS factory_name,
        COALESCE(SUM(i.quantity_on_hand), 0) AS qty_remaining
      FROM product_batches pb
      JOIN products p ON p.id = pb.product_id
      LEFT JOIN factories f ON f.id = pb.factory_id
      LEFT JOIN inventory i ON i.batch_id = pb.id
      WHERE
        (COALESCE({{params.product_id}}, '') = '' OR pb.product_id::text = {{params.product_id}})
        AND (COALESCE({{params.factory_id}}, '') = '' OR pb.factory_id::text = {{params.factory_id}})
        AND (COALESCE({{params.qc_status}}, '') = '' OR pb.qc_status = {{params.qc_status}})
        AND ({{params.date_from}} IS NULL OR pb.manufacture_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR pb.manufacture_date <= {{params.date_to}}::date)
        AND (COALESCE({{params.search}}, '') = '' OR pb.batch_number ILIKE {{ '%' + params.search + '%' }} OR p.name ILIKE {{ '%' + params.search + '%' }} OR p.sku ILIKE {{ '%' + params.search + '%' }})
      GROUP BY pb.id, p.sku, p.name, p.standard_cost, f.name
      ORDER BY pb.manufacture_date DESC
    `,
  });
}

export default listBatches;
