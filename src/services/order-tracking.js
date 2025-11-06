import mysql from 'mysql2/promise';
import { config } from '../config/config.js';
import axios from 'axios';

/**
 * Order Tracking Service
 * Connects to OpenCart database and Ship Logic API for real-time order tracking
 */
export class OrderTrackingService {
  constructor() {
    // OpenCart database connection config
    this.dbConfig = {
      host: process.env.OPENCART_DB_HOST,
      port: parseInt(process.env.OPENCART_DB_PORT) || 3306,
      user: process.env.OPENCART_DB_USER,
      password: process.env.OPENCART_DB_PASSWORD,
      database: process.env.OPENCART_DB_NAME,
    };

    this.tablePrefix = process.env.OPENCART_TABLE_PREFIX || 'oc_';
    this.shipLogicApiKey = process.env.SHIP_LOGIC_API_KEY || '51992342aace4912b4bc0ae4c3b9381b';
  }

  /**
   * Get database connection
   * @returns {Promise<Connection>}
   */
  async getConnection() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);
      return connection;
    } catch (error) {
      console.error('[OrderTracking] Database connection error:', error.message);
      throw new Error('Unable to connect to order database');
    }
  }

  /**
   * Track order by order number
   * @param {string} orderNumber - Order number or ID
   * @returns {Promise<object>} - Order details with tracking info
   */
  async trackOrder(orderNumber) {
    let connection;

    try {
      connection = await this.getConnection();

      // Query OpenCart database for order
      const [orders] = await connection.execute(
        `SELECT
          o.order_id,
          o.invoice_no,
          o.firstname,
          o.lastname,
          o.email,
          o.telephone,
          o.total,
          o.currency_code,
          o.order_status_id,
          os.name as status_name,
          o.date_added,
          o.date_modified,
          o.shipping_method,
          o.shipping_address_1,
          o.shipping_address_2,
          o.shipping_city,
          o.shipping_postcode,
          o.shipping_country
        FROM ${this.tablePrefix}order o
        LEFT JOIN ${this.tablePrefix}order_status os ON o.order_status_id = os.order_status_id AND os.language_id = 1
        WHERE o.order_id = ? OR o.invoice_no = ?
        LIMIT 1`,
        [orderNumber, orderNumber]
      );

      if (orders.length === 0) {
        return {
          found: false,
          message: `Order ${orderNumber} not found. Please check the order number and try again.`
        };
      }

      const order = orders[0];

      // Get order products
      const [products] = await connection.execute(
        `SELECT
          name,
          model,
          quantity,
          price,
          total
        FROM ${this.tablePrefix}order_product
        WHERE order_id = ?`,
        [order.order_id]
      );

      // Get order history (status changes)
      const [history] = await connection.execute(
        `SELECT
          oh.date_added,
          os.name as status,
          oh.comment,
          oh.notify
        FROM ${this.tablePrefix}order_history oh
        LEFT JOIN ${this.tablePrefix}order_status os ON oh.order_status_id = os.order_status_id AND os.language_id = 1
        WHERE oh.order_id = ?
        ORDER BY oh.date_added DESC`,
        [order.order_id]
      );

      // Try to get tracking from Ship Logic API
      let trackingInfo = null;
      try {
        trackingInfo = await this.getShipLogicTracking(order.order_id);
      } catch (error) {
        console.log('[OrderTracking] Ship Logic tracking not available:', error.message);
      }

      return {
        found: true,
        order: {
          orderNumber: order.order_id,
          invoiceNumber: order.invoice_no,
          customer: {
            name: `${order.firstname} ${order.lastname}`,
            email: order.email,
            phone: order.telephone,
          },
          status: order.status_name,
          statusId: order.order_status_id,
          orderDate: order.date_added,
          lastUpdate: order.date_modified,
          total: `${order.currency_code} ${parseFloat(order.total).toFixed(2)}`,
          shipping: {
            method: order.shipping_method,
            address: `${order.shipping_address_1}${order.shipping_address_2 ? ', ' + order.shipping_address_2 : ''}, ${order.shipping_city}, ${order.shipping_postcode}, ${order.shipping_country}`,
          },
          products: products.map(p => ({
            name: p.name,
            model: p.model,
            quantity: p.quantity,
            price: `${order.currency_code} ${parseFloat(p.price).toFixed(2)}`,
          })),
          history: history.map(h => ({
            date: h.date_added,
            status: h.status,
            comment: h.comment,
          })),
          tracking: trackingInfo,
        }
      };
    } catch (error) {
      console.error('[OrderTracking] Error tracking order:', error.message);
      throw new Error(`Order tracking failed: ${error.message}`);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Search orders by customer email
   * @param {string} email - Customer email
   * @returns {Promise<Array>} - List of orders
   */
  async findOrdersByEmail(email) {
    let connection;

    try {
      connection = await this.getConnection();

      const [orders] = await connection.execute(
        `SELECT
          o.order_id,
          o.invoice_no,
          o.total,
          o.currency_code,
          os.name as status,
          o.date_added
        FROM ${this.tablePrefix}order o
        LEFT JOIN ${this.tablePrefix}order_status os ON o.order_status_id = os.order_status_id AND os.language_id = 1
        WHERE o.email = ?
        ORDER BY o.date_added DESC
        LIMIT 10`,
        [email]
      );

      if (orders.length === 0) {
        return {
          found: false,
          message: `No orders found for email: ${email}`
        };
      }

      return {
        found: true,
        orders: orders.map(o => ({
          orderNumber: o.order_id,
          invoiceNumber: o.invoice_no,
          total: `${o.currency_code} ${parseFloat(o.total).toFixed(2)}`,
          status: o.status,
          orderDate: o.date_added,
        }))
      };
    } catch (error) {
      console.error('[OrderTracking] Error finding orders by email:', error.message);
      throw new Error(`Order search failed: ${error.message}`);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Get Ship Logic tracking information
   * @param {string} orderNumber - Order number
   * @returns {Promise<object>} - Tracking information
   */
  async getShipLogicTracking(orderNumber) {
    try {
      // Ship Logic API endpoint (adjust based on actual API documentation)
      const response = await axios.get(`https://api.shiplogic.com/v2/track/${orderNumber}`, {
        headers: {
          'Authorization': `Bearer ${this.shipLogicApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      if (response.data && response.data.tracking) {
        return {
          trackingNumber: response.data.tracking.tracking_number,
          carrier: response.data.tracking.carrier,
          status: response.data.tracking.status,
          estimatedDelivery: response.data.tracking.estimated_delivery,
          currentLocation: response.data.tracking.current_location,
          events: response.data.tracking.events || [],
        };
      }

      return null;
    } catch (error) {
      // Ship Logic tracking not available - this is OK
      console.log('[OrderTracking] Ship Logic API not available:', error.message);
      return null;
    }
  }

  /**
   * Format order information for AI agent
   * @param {object} orderInfo - Order information
   * @returns {string} - Formatted text
   */
  formatOrderInfo(orderInfo) {
    if (!orderInfo.found) {
      return orderInfo.message;
    }

    const { order } = orderInfo;
    let formatted = `📦 ORDER #${order.orderNumber}\n\n`;

    formatted += `Status: ${order.status}\n`;
    formatted += `Order Date: ${new Date(order.orderDate).toLocaleDateString('en-ZA')}\n`;
    formatted += `Total: ${order.total}\n\n`;

    formatted += `Customer: ${order.customer.name}\n`;
    formatted += `Email: ${order.customer.email}\n`;
    formatted += `Phone: ${order.customer.phone}\n\n`;

    formatted += `Shipping:\n`;
    formatted += `Method: ${order.shipping.method}\n`;
    formatted += `Address: ${order.shipping.address}\n\n`;

    if (order.tracking) {
      formatted += `📍 TRACKING INFORMATION:\n`;
      formatted += `Tracking Number: ${order.tracking.trackingNumber}\n`;
      formatted += `Carrier: ${order.tracking.carrier}\n`;
      formatted += `Status: ${order.tracking.status}\n`;
      if (order.tracking.currentLocation) {
        formatted += `Current Location: ${order.tracking.currentLocation}\n`;
      }
      if (order.tracking.estimatedDelivery) {
        formatted += `Estimated Delivery: ${new Date(order.tracking.estimatedDelivery).toLocaleDateString('en-ZA')}\n`;
      }
      formatted += '\n';
    }

    formatted += `Products:\n`;
    order.products.forEach((product, idx) => {
      formatted += `${idx + 1}. ${product.name} (${product.model}) - Qty: ${product.quantity} - ${product.price}\n`;
    });

    if (order.history && order.history.length > 0) {
      formatted += `\nRecent Updates:\n`;
      order.history.slice(0, 3).forEach(h => {
        formatted += `- ${new Date(h.date).toLocaleDateString('en-ZA')}: ${h.status}`;
        if (h.comment) {
          formatted += ` - ${h.comment}`;
        }
        formatted += '\n';
      });
    }

    return formatted;
  }

  /**
   * Format order list for AI agent
   * @param {object} ordersInfo - Orders information
   * @returns {string} - Formatted text
   */
  formatOrderList(ordersInfo) {
    if (!ordersInfo.found) {
      return ordersInfo.message;
    }

    let formatted = `Found ${ordersInfo.orders.length} orders:\n\n`;

    ordersInfo.orders.forEach((order, idx) => {
      formatted += `${idx + 1}. Order #${order.orderNumber} - ${order.status}\n`;
      formatted += `   Date: ${new Date(order.orderDate).toLocaleDateString('en-ZA')}\n`;
      formatted += `   Total: ${order.total}\n\n`;
    });

    formatted += 'Which order would you like to track in detail?';

    return formatted;
  }
}

// Singleton instance
export const orderTrackingService = new OrderTrackingService();
