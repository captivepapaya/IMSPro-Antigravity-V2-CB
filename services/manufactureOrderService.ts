import { getSupabase } from './supabaseClient';
import { ManufactureOrder, ManufactureOrderItem } from '../types';

const supabase = getSupabase();

/**
 * Manufacture Order Service
 * Manages manufacturing orders and inventory updates
 */

class ManufactureOrderService {
    private tableName = 'manufacture_orders';

    /**
     * Generate order ID based on current date
     * Format: YYYYMMDDM (e.g., 20251224M)
     */
    generateOrderId(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}M`;
    }

    /**
     * Fetch all manufacture orders
     */
    async fetchAllOrders(): Promise<ManufactureOrder[]> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching manufacture orders:', error);
                throw error;
            }

            // Group items by order_id
            const ordersMap = new Map<string, ManufactureOrder>();

            (data || []).forEach((item: ManufactureOrderItem) => {
                if (!ordersMap.has(item.order_id)) {
                    ordersMap.set(item.order_id, {
                        order_id: item.order_id,
                        created_at: item.created_at,
                        items: []
                    });
                }
                ordersMap.get(item.order_id)!.items!.push(item);
            });

            return Array.from(ordersMap.values());
        } catch (error) {
            console.error('Failed to fetch manufacture orders:', error);
            return [];
        }
    }

    /**
     * Fetch a specific manufacture order by ID
     */
    async fetchOrderById(orderId: string): Promise<ManufactureOrder | null> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error(`Error fetching order ${orderId}:`, error);
                throw error;
            }

            if (!data || data.length === 0) {
                return null;
            }

            return {
                order_id: orderId,
                created_at: data[0].created_at,
                items: data as ManufactureOrderItem[]
            };
        } catch (error) {
            console.error(`Failed to fetch order ${orderId}:`, error);
            return null;
        }
    }

    /**
     * Create a new manufacture order with items
     */
    async createOrder(orderId: string, items: Omit<ManufactureOrderItem, 'id' | 'order_id' | 'created_at'>[]): Promise<boolean> {
        try {
            // Prepare items with order_id
            const orderItems = items.map(item => ({
                order_id: orderId,
                product_code: item.product_code,
                bom_code: item.bom_code,
                qty_bom: item.qty_bom,
                quantity_produced: item.quantity_produced
            }));

            const { error } = await supabase
                .from(this.tableName)
                .insert(orderItems);

            if (error) {
                console.error('Error creating manufacture order:', error);
                throw error;
            }

            console.log(`✅ Manufacture order ${orderId} created with ${items.length} items`);
            return true;
        } catch (error) {
            console.error('Failed to create manufacture order:', error);
            return false;
        }
    }

    /**
     * Delete a manufacture order
     */
    async deleteOrder(orderId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('order_id', orderId);

            if (error) {
                console.error(`Error deleting order ${orderId}:`, error);
                throw error;
            }

            console.log(`✅ Manufacture order ${orderId} deleted`);
            return true;
        } catch (error) {
            console.error(`Failed to delete order ${orderId}:`, error);
            return false;
        }
    }

    /**
     * Update comment field with manufacture order ID
     * Maintains max 3 records separated by semicolons
     */
    updateComment(existingComment: string, orderId: string): string {
        const records = existingComment ? existingComment.split(';').map(r => r.trim()).filter(Boolean) : [];

        // Add new record at the beginning
        records.unshift(orderId);

        // Keep only the latest 3 records
        const updatedRecords = records.slice(0, 3);

        return updatedRecords.join('; ');
    }
}

export const manufactureOrderService = new ManufactureOrderService();
