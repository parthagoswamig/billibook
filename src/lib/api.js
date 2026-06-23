import { supabase } from "../db";

// Generic CRUD operations
export const fetchData = async (tableName, userId) => {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
};

export const addData = async (tableName, payload) => {
  const { data, error } = await supabase
    .from(tableName)
    .insert([payload])
    .select();
  if (error) throw error;
  return data[0];
};

export const updateData = async (tableName, id, payload) => {
  const { data, error } = await supabase
    .from(tableName)
    .update(payload)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data[0];
};

export const deleteData = async (tableName, id) => {
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) throw error;
  return true;
};

// Specific API calls for different modules
export const getCustomers = async (userId) =>
  fetchData("customers", userId);
export const addCustomer = async (customer) => addData("customers", customer);
export const updateCustomer = async (id, customer) =>
  updateData("customers", id, customer);
export const deleteCustomer = async (id) => deleteData("customers", id);

export const getProducts = async (userId) => fetchData("products", userId);
export const addProduct = async (product) => addData("products", product);
export const updateProduct = async (id, product) =>
  updateData("products", id, product);
export const deleteProduct = async (id) => deleteData("products", id);

export const getInvoices = async (userId) => fetchData("invoices", userId);
export const addInvoice = async (invoice) => addData("invoices", invoice);
export const updateInvoice = async (id, invoice) =>
  updateData("invoices", id, invoice);
export const deleteInvoice = async (id) => deleteData("invoices", id);

export const getInvoiceItems = async (invoiceId) => {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return data;
};
export const addInvoiceItem = async (item) => addData("invoice_items", item);
export const updateInvoiceItem = async (id, item) =>
  updateData("invoice_items", id, item);
export const deleteInvoiceItem = async (id) => deleteData("invoice_items", id);

export const getInvoicePayments = async (invoiceId) => {
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return data;
};
export const addInvoicePayment = async (payment) =>
  addData("invoice_payments", payment);
export const updateInvoicePayment = async (id, payment) =>
  updateData("invoice_payments", id, payment);
export const deleteInvoicePayment = async (id) =>
  deleteData("invoice_payments", id);

export const getExpenses = async (userId) => fetchData("expenses", userId);
export const addExpense = async (expense) => addData("expenses", expense);
export const updateExpense = async (id, expense) =>
  updateData("expenses", id, expense);
export const deleteExpense = async (id) => deleteData("expenses", id);

export const getBusinessProfile = async (userId) => {
  const { data, error } = await supabase
    .from("business_profile")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
};
export const createBusinessProfile = async (profile) =>
  addData("business_profile", profile);
export const updateBusinessProfile = async (userId, profile) => {
  const { data, error } = await supabase
    .from("business_profile")
    .update(profile)
    .eq("user_id", userId)
    .select();
  if (error) throw error;
  return data[0];
};
