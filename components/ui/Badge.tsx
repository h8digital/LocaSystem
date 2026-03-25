const map: Record<string,string> = {
  ativo:'green', inativo:'gray', rascunho:'gray', encerrado:'gray',
  cancelado:'red', inadimplente:'yellow', pendente:'yellow', pago:'green',
  vencido:'red', parcial:'blue', disponivel:'green', locado:'blue',
  manutencao:'yellow', reservado:'orange', descartado:'gray',
  aberto:'yellow', em_andamento:'blue', concluido:'green',
  limpo:'green', restrito:'yellow', negativado:'red', nao_consultado:'gray',
  PF:'blue', PJ:'orange',
}
interface BadgeProps { value:string; label?:string; dot?:boolean }
export default function Badge({ value, label, dot }: BadgeProps) {
  const color = map[value]??'gray'
  const text  = label??value.replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase())
  return (
    <span className={`ds-badge ds-badge-${color}`}>
      {dot&&<span className="ds-badge-dot"/>}{text}
    </span>
  )
}
