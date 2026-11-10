/** Display in-game credits with a literal space grouping separator regardless of locale. */
export function formatCredits(amount:number):string{
  return Math.trunc(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g," ");
}
