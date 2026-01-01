import { getSupabase } from './supabaseClient';
import { PPIRecord } from '../types';

const supabase = getSupabase();

/**
 * PPI Service - Manages Product-Parts-Inventory (BOM) relationships
 * Handles CRUD operations for manufactured products and their raw materials
 */

class PPIService {
    private tableName = 'ppi';

    /**
     * Fetch all PPI records from Supabase
     */
    async fetchAll(): Promise<PPIRecord[]> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .order('code', { ascending: true });

            if (error) {
                console.error('Error fetching PPI records:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Failed to fetch PPI records:', error);
            return [];
        }
    }

    /**
     * Fetch PPI records for a specific product code
     * @param code - Product code
     */
    async fetchByCode(code: string): Promise<PPIRecord[]> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('code', code)
                .order('bom', { ascending: true });

            if (error) {
                console.error(`Error fetching PPI records for code ${code}:`, error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error(`Failed to fetch PPI records for code ${code}:`, error);
            return [];
        }
    }

    /**
     * Fetch a single PPI record by code and bom
     * @param code - Product code
     * @param bom - BOM code
     */
    async fetchByCodeAndBom(code: string, bom: string): Promise<PPIRecord | null> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('code', code)
                .eq('bom', bom)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows found
                    return null;
                }
                console.error(`Error fetching PPI record for ${code}/${bom}:`, error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error(`Failed to fetch PPI record for ${code}/${bom}:`, error);
            return null;
        }
    }

    /**
     * Create or update a PPI record
     * @param code - Product code
     * @param bom - BOM code
     * @param qtyBom - Quantity of BOM required
     */
    async upsert(code: string, bom: string, qtyBom: number): Promise<PPIRecord | null> {
        try {
            // Validation
            if (!code || !bom) {
                console.error('Code and BOM are required');
                return null;
            }

            if (qtyBom < 1) {
                console.error('QtyBom must be at least 1');
                return null;
            }

            const { data, error } = await supabase
                .from(this.tableName)
                .upsert({
                    code,
                    bom,
                    qty_bom: qtyBom
                }, {
                    onConflict: 'code,bom'
                })
                .select()
                .single();

            if (error) {
                console.error('Error upserting PPI record:', error);
                throw error;
            }

            console.log(`✅ PPI record upserted: ${code} -> ${bom} (${qtyBom})`);
            return data;
        } catch (error) {
            console.error('Failed to upsert PPI record:', error);
            return null;
        }
    }

    /**
     * Delete a PPI record
     * @param code - Product code
     * @param bom - BOM code
     */
    async delete(code: string, bom: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('code', code)
                .eq('bom', bom);

            if (error) {
                console.error(`Error deleting PPI record ${code}/${bom}:`, error);
                throw error;
            }

            console.log(`✅ PPI record deleted: ${code} -> ${bom}`);
            return true;
        } catch (error) {
            console.error(`Failed to delete PPI record ${code}/${bom}:`, error);
            return false;
        }
    }

    /**
     * Delete all PPI records for a specific product code
     * @param code - Product code
     */
    async deleteByCode(code: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('code', code);

            if (error) {
                console.error(`Error deleting PPI records for code ${code}:`, error);
                throw error;
            }

            console.log(`✅ All PPI records deleted for code: ${code}`);
            return true;
        } catch (error) {
            console.error(`Failed to delete PPI records for code ${code}:`, error);
            return false;
        }
    }

    /**
     * Sync PPI record for a product
     * This is the main method to be called when saving a product with BOM data
     * @param code - Product code
     * @param bom - BOM code (empty string to delete)
     * @param qtyBom - Quantity of BOM required
     */
    async syncProductBom(code: string, bom: string, qtyBom: number): Promise<boolean> {
        try {
            // If both bom and qtyBom are empty/zero, delete any existing records
            if (!bom || qtyBom < 1) {
                await this.deleteByCode(code);
                return true;
            }

            // Otherwise, upsert the record
            const result = await this.upsert(code, bom, qtyBom);
            return result !== null;
        } catch (error) {
            console.error(`Failed to sync PPI for ${code}:`, error);
            return false;
        }
    }
}

export const ppiService = new PPIService();
