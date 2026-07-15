import { action } from '@uibakery/data';

/**
 * Passed-QC batches that currently have sellable stock (> 0 available across
 * all warehouses), FIFO-ordered. Drives the per-line batch picker in the
 * order form: a line shows the picker only when its product appears here
 * more than once.
 */
function listBatchStock() {
  return action('listBatchStock', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        pb.id, pb.product_id, pb.batch_number, pb.manufacture_date,
        COALESCE(SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved)), 0)::int AS available
      FROM product_batches pb
      JOIN inventory i ON i.batch_id = pb.id
      WHERE pb.qc_status = 'passed'
      GROUP BY pb.id, pb.product_id, pb.batch_number, pb.manufacture_date
      HAVING SUM(GREATEST(0, i.quantity_on_hand - i.quantity_reserved)) > 0
      ORDER BY pb.product_id, pb.manufacture_date ASC NULLS LAST, pb.id ASC
    `,
  });
}

export default listBatchStock;
