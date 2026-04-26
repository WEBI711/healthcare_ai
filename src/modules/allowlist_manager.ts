import { AllowListModel, IAllowList } from '#database/index.js'
export async function check_if_allowed(number: string) {
  const result = await AllowListModel.exists({ number: number });
  return result || false;
}
export async function allow(number: string) {
  return await AllowListModel.create({ number: number });
}

