import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Crown } from 'lucide-react';
import { DateRange, exportCSV } from './dateRangeUtils';
import getTopCustomers from '@/actions/reports/getTopCustomers';
import getTopProducts from '@/actions/reports/getTopProducts';

type Customer = {
  rank: number; customer_id: number; full_name: string; email: string; is_vip: boolean;
  order_count: number; total_spend: number; avg_order_value: number; last_order_date: string;
};
type Product = {
  product_id: number; sku: string; product_name: string; units_sold: number; revenue: number;
};

interface Props { range: DateRange }

export function TopTablesSection({ range }: Props) {
  const [topN, setTopN] = useState(25);
  const [productSort, setProductSort] = useState('units');

  const params = { date_from: range.from || null, date_to: range.to || null, top_n: topN };

  const [customers] = useLoadAction(getTopCustomers, [], params);
  const [products] = useLoadAction(getTopProducts, [], { ...params, sort_by: productSort });

  const customerList = (customers as Customer[]) || [];
  const productList = (products as Product[]) || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Top Customers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Top Customers</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Top</span>
              <Input
                type="number" min={5} max={100} value={topN}
                onChange={e => setTopN(Number(e.target.value))}
                className="w-16 h-7 text-xs"
              />
              <Button variant="outline" size="sm" onClick={() => exportCSV('top_customers.csv', customerList as unknown as Record<string, unknown>[])}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Spend</TableHead>
                  <TableHead className="text-right">Avg Order</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerList.map(c => (
                  <TableRow key={c.customer_id}>
                    <TableCell className="text-gray-400 font-mono text-xs">{c.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {c.is_vip && <Crown className="h-3 w-3 text-amber-500" />}
                        <div>
                          <div className="font-medium text-sm">{c.full_name}</div>
                          <div className="text-xs text-gray-400">{c.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{c.order_count}</TableCell>
                    <TableCell className="text-right font-medium text-sm">${Number(c.total_spend).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">${Number(c.avg_order_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-xs text-gray-500">{c.last_order_date?.split('T')[0]}</TableCell>
                  </TableRow>
                ))}
                {customerList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Top Products</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={productSort} onValueChange={setProductSort}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="units">By Units</SelectItem>
                  <SelectItem value="revenue">By Revenue</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => exportCSV('top_products.csv', productList as unknown as Record<string, unknown>[])}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productList.map((p, idx) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="text-gray-400 font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{p.product_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{Number(p.units_sold).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-sm">${Number(p.revenue).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {productList.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
