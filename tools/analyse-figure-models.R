# Binomial SAT parameter recovery on the actual two-session trial allocation.
args<-commandArgs(trailingOnly=TRUE)
out<-if(length(args))args[1] else 'output/figure-matched-simulation'
cells<-read.csv(file.path(out,'cohort_cell_counts.csv'),stringsAsFactors=FALSE)
truth<-read.csv(file.path(out,'generating_parameters.csv'),stringsAsFactors=FALSE)
cues<-c('valid','neutral','invalid')
models<-c('null','onset_only','rate_only','plateau_only','combined')
titles<-c(null='No cue effect',onset_only='Earlier onset',rate_only='Faster rise',plateau_only='Higher plateau',combined='Combined effects')
colours<-c(valid='#176e87',neutral='#666f76',invalid='#b64939')
shapes<-c(valid=16,neutral=17,invalid=15)
gamma<-1/9
sat<-function(time,onset,rate,plateau)gamma+(plateau-gamma)*(-expm1(-rate*pmax(0,time-onset)))
stopifnot(nrow(cells)==1215,all(cells$trials==ifelse(cells$cue_validity=='valid',540,180)),all(cells$correct>=0&cells$correct<=cells$trials))
# All fits use observed counts only. Generating parameters are never initializers.
fitCurve<-function(time,successes,trials,start=NULL,multistart=TRUE) {
  objective<-function(p) {q<-pmin(1-1e-10,pmax(1e-10,sat(time,p[1],exp(p[2]),p[3])));-sum(successes*log(q)+(trials-successes)*log1p(-q))}
  tail<-sum(successes[time>=1.6])/sum(trials[time>=1.6]); tail<-max(gamma+.05,min(.995,tail))
  starts<-list(c(.06,log(6),tail),c(.16,log(3),tail),c(.30,log(1.5),tail))
  if(!is.null(start))starts<-c(list(start),if(multistart)starts else list())
  fits<-lapply(starts,function(s)tryCatch(optim(s,objective,method='L-BFGS-B',lower=c(0,log(.2),gamma+.001),upper=c(.8,log(25),.99999),control=list(maxit=1000,factr=1e7)),error=function(e)NULL))
  good<-vapply(fits,function(x)!is.null(x)&&is.finite(x$value)&&x$convergence==0,logical(1))
  if(!any(good))stop('No converged curve fit')
  fits<-fits[good];best<-fits[[which.min(vapply(fits,function(x)x$value,numeric(1)))]]
  list(par=best$par,nll=best$value,convergence=best$convergence)
}
fitModel<-function(z,model) {
  time<-z$signal_delay_ms/1000;ci<-match(z$cue_validity,cues)
  free<-c(onset=model%in%c('onset_only','combined'),rate=model%in%c('rate_only','combined'),plateau=model%in%c('plateau_only','combined'))
  sizes<-ifelse(free,3L,1L);ends<-cumsum(sizes);begins<-c(1,head(ends,-1)+1)
  decode<-function(par) lapply(seq_len(3),function(i){v<-par[begins[i]:ends[i]];if(length(v)==1)rep(v,3) else v})
  objective<-function(par) {p<-decode(par);q<-pmin(1-1e-10,pmax(1e-10,sat(time,p[[1]][ci],exp(p[[2]][ci]),p[[3]][ci])));-sum(z$correct*log(q)+(z$trials-z$correct)*log1p(-q))}
  if(model=='combined') {
    independent<-lapply(cues,function(cue){x<-z[z$cue_validity==cue,];fitCurve(x$signal_delay_ms/1000,x$correct,x$trials)})
    pars<-c(vapply(independent,function(x)x$par[1],0),vapply(independent,function(x)x$par[2],0),vapply(independent,function(x)x$par[3],0))
    best<-list(par=pars,value=objective(pars),convergence=0)
  } else {
    tail<-aggregate(cbind(correct,trials)~cue_validity,z[z$signal_delay_ms>=1600,],sum)
    plateau<-setNames(tail$correct/tail$trials,tail$cue_validity)[cues]
    plateau<-pmin(.995,pmax(gamma+.05,plateau))
    lower<-c(rep(0,sizes[1]),rep(log(.2),sizes[2]),rep(gamma+.001,sizes[3]))
    upper<-c(rep(.8,sizes[1]),rep(log(25),sizes[2]),rep(.99999,sizes[3]))
    fits<-lapply(1:4,function(i) {
      p<-c(rep(c(.04,.12,.23,.34)[i],sizes[1]),rep(log(c(7,4,2.5,1.5)[i]),sizes[2]),if(free[3])plateau else mean(plateau))
      tryCatch(optim(p,objective,method='L-BFGS-B',lower=lower,upper=upper,control=list(maxit=1500,factr=1e7)),error=function(e)NULL)
    })
    good<-vapply(fits,function(x)!is.null(x)&&is.finite(x$value)&&x$convergence==0,logical(1))
    if(!any(good))stop(paste('No converged fit:',model))
    fits<-fits[good];best<-fits[[which.min(vapply(fits,function(x)x$value,0))]]
  }
  p<-decode(best$par)
  list(model=model,nll=best$value,k=sum(sizes),aic=2*sum(sizes)+2*best$value,bic=log(sum(z$trials))*sum(sizes)+2*best$value,convergence=best$convergence,
       parameters=data.frame(cue_validity=cues,onset_ms=1000*p[[1]],rate_per_second=exp(p[[2]]),plateau=p[[3]]))
}
fits<-list();comparisons<-list();estimates<-list();j<-0L
for(scenario in models)for(n in 1:9) {
  z<-cells[cells$scenario==scenario&cells$target_numerosity==n,]
  key<-paste(scenario,n,sep='/');fits[[key]]<-setNames(lapply(models,function(m)fitModel(z,m)),models)
  for(model in models) {
    f<-fits[[key]][[model]];j<-j+1L
    comparisons[[j]]<-data.frame(scenario,target_numerosity=n,fitted_model=model,nll=f$nll,parameters=f$k,aic=f$aic,bic=f$bic,convergence=f$convergence)
    estimates[[j]]<-cbind(scenario,target_numerosity=n,fitted_model=model,f$parameters)
  }
  cat('Fitted',scenario,'numerosity',n,'\n')
}
comparisons<-do.call(rbind,comparisons);estimates<-do.call(rbind,estimates)
write.csv(comparisons,file.path(out,'candidate_model_comparisons.csv'),row.names=FALSE)
write.csv(estimates,file.path(out,'fitted_parameters_all_models.csv'),row.names=FALSE)
winners<-do.call(rbind,lapply(split(comparisons,interaction(comparisons$scenario,comparisons$target_numerosity,drop=TRUE)),function(x)data.frame(scenario=x$scenario[1],target_numerosity=x$target_numerosity[1],aic_winner=x$fitted_model[which.min(x$aic)],bic_winner=x$fitted_model[which.min(x$bic)])))
write.csv(winners,file.path(out,'model_selection.csv'),row.names=FALSE)
selection<-as.data.frame(table(generating_scenario=winners$scenario,selected_model=winners$aic_winner));selection<-selection[selection$Freq>0,]
write.csv(selection,file.path(out,'model_selection_summary.csv'),row.names=FALSE)

# Independent binomial parametric bootstrap for the 27 combined-scenario curves.
# This quantifies ideal pooled-curve uncertainty, not participant population uncertainty.
set.seed(20261020);B<-200L;recovery<-list();bootAll<-list();j<-0L
for(n in 1:9)for(cue in cues) {
  z<-cells[cells$scenario=='combined'&cells$target_numerosity==n&cells$cue_validity==cue,]
  f<-fitCurve(z$signal_delay_ms/1000,z$correct,z$trials)
  q<-sat(z$signal_delay_ms/1000,f$par[1],exp(f$par[2]),f$par[3])
  samples<-matrix(NA_real_,B,3)
  for(b in seq_len(B)) {
    y<-rbinom(nrow(z),z$trials,q)
    fb<-tryCatch(fitCurve(z$signal_delay_ms/1000,y,z$trials,start=f$par,multistart=TRUE),error=function(e)NULL)
    if(!is.null(fb))samples[b,]<-c(fb$par[1]*1000,exp(fb$par[2]),fb$par[3])
  }
  j<-j+1L;t<-truth[truth$scenario=='combined'&truth$target_numerosity==n&truth$cue_validity==cue,]
  estimatesHere<-c(f$par[1]*1000,exp(f$par[2]),f$par[3]);namesHere<-c('onset_ms','rate_per_second','plateau')
  recovery[[j]]<-do.call(rbind,lapply(1:3,function(i)data.frame(target_numerosity=n,cue_validity=cue,parameter=namesHere[i],specified=t[[namesHere[i]]],estimate=estimatesHere[i],ci_low=quantile(samples[,i],.025,na.rm=TRUE),ci_high=quantile(samples[,i],.975,na.rm=TRUE),bootstrap_success=sum(complete.cases(samples)),bootstrap_replicates=B)))
  bootAll[[j]]<-data.frame(target_numerosity=n,cue_validity=cue,replicate=1:B,onset_ms=samples[,1],rate_per_second=samples[,2],plateau=samples[,3])
}
recovery<-do.call(rbind,recovery);bootAll<-do.call(rbind,bootAll)
write.csv(recovery,file.path(out,'combined_parameter_recovery.csv'),row.names=FALSE)
write.csv(bootAll,file.path(out,'combined_bootstrap_draws.csv'),row.names=FALSE)
accuracyErrors<-transform(recovery,error=estimate-specified)
rmse<-aggregate(error~parameter,accuracyErrors,function(x)sqrt(mean(x^2)))
write.csv(rmse,file.path(out,'parameter_rmse.csv'),row.names=FALSE)

drawLegend<-function()legend('center',c('Valid','Neutral','Invalid'),col=colours,pch=shapes,lty=1,horiz=TRUE,bty='n',cex=1)
png(file.path(out,'combined_accuracy_curves.png'),width=2100,height=1900,res=160)
layout(matrix(c(1:9,10,10,10),nrow=4,byrow=TRUE),heights=c(1,1,1,.12))
par(mar=c(4.2,4.2,2.4,1),oma=c(2,1,4,0),mgp=c(2.4,.7,0),las=1)
for(n in 1:9) {
  z<-cells[cells$scenario=='combined'&cells$target_numerosity==n,];f<-fits[[paste('combined',n,sep='/')]][['combined']]$parameters
  plot(NA,xlim=c(0,4000),ylim=c(0,1),xlab='Processing time (ms)',ylab='Exact-response probability',main=paste(n,if(n==1)'dot' else 'dots'),xaxt='n');axis(1,at=seq(0,4000,1000));abline(h=gamma,lty=3,col='#aaa')
  for(cue in cues) {
    p<-truth[truth$scenario=='combined'&truth$target_numerosity==n&truth$cue_validity==cue,];fp<-f[f$cue_validity==cue,];time<-seq(0,4000,5)
    lines(time,sat(time/1000,p$onset_ms/1000,p$rate_per_second,p$plateau),col=colours[cue],lwd=2)
    lines(time,sat(time/1000,fp$onset_ms/1000,fp$rate_per_second,fp$plateau),col=colours[cue],lwd=1.5,lty=2)
    a<-z[z$cue_validity==cue,];points(a$signal_delay_ms,a$observed_accuracy,col=adjustcolor(colours[cue],.75),pch=shapes[cue],cex=.7)
  }
}
par(mar=rep(0,4));plot.new();drawLegend()
mtext('SYNTHETIC: combined onset, rate and plateau effects across numerosities 1-9',outer=TRUE,line=2.1,cex=1.2,font=2)
mtext('45 participants; actual two-session schedule. Solid: specified model. Dashed: binomial fit. Points: simulated accuracy.',outer=TRUE,line=.6,cex=.85)
mtext('Time = array onset to scheduled tone; exposure fixed at 66.7 ms. Floor = 1/9 by assumption.',side=1,outer=TRUE,line=.6,cex=.85)
dev.off()

png(file.path(out,'parameter_recovery.png'),width=2200,height=950,res=160)
layout(matrix(c(1,2,3,4,4,4),nrow=2,byrow=TRUE),heights=c(1,.16))
par(mar=c(4.5,4.5,3,1),oma=c(2,1,4,0),las=1,mgp=c(2.5,.8,0))
for(parameter in c('onset_ms','rate_per_second','plateau')) {
  a<-recovery[recovery$parameter==parameter,]
  title<-switch(parameter,onset_ms='Onset (ms)',rate_per_second='Rise rate (per second)',plateau='Attainable accuracy')
  plot(NA,xlim=c(.7,9.3),ylim=range(c(a$specified,a$ci_low,a$ci_high)),xlab='Number of dots',ylab='',main=title,xaxt='n');axis(1,at=1:9)
  for(cue in cues) {
    z<-a[a$cue_validity==cue,];z<-z[order(z$target_numerosity),];x<-z$target_numerosity
    lines(x,z$specified,col=colours[cue],lwd=2)
    segments(x,z$ci_low,x,z$ci_high,col=adjustcolor(colours[cue],.4))
    points(x,z$estimate,col=colours[cue],pch=shapes[cue],cex=.85)
  }
}
par(mar=rep(0,4));plot.new();drawLegend()
mtext('SYNTHETIC parameter recovery using the actual experiment schedule',outer=TRUE,line=2,cex=1.2,font=2)
mtext('Lines: specified values reconstructed from Image #1. Points: fitted values. Bars: 95% parametric-bootstrap intervals (200 draws).',outer=TRUE,line=.5,cex=.82)
mtext('Ideal pooled binomial curves; no participant variation, lapses or timing noise.',side=1,outer=TRUE,line=.5,cex=.85)
dev.off()

png(file.path(out,'candidate_models.png'),width=1800,height=1500,res=150)
layout(matrix(c(1,2,3,4,5,5),nrow=3,byrow=TRUE),heights=c(1,1,.12))
par(mar=c(4.5,4.5,3.5,1),oma=c(2,1,4,0),las=1,mgp=c(2.5,.8,0))
for(scenario in models[-1]) {
  n<-6;z<-cells[cells$scenario==scenario&cells$target_numerosity==n,];f<-fits[[paste(scenario,n,sep='/')]][[scenario]]$parameters
  plot(NA,xlim=c(0,3500),ylim=c(0,1),xlab='Processing time (ms)',ylab='Exact-response probability',main=paste(titles[scenario],'\n6 dots'),xaxt='n');axis(1,at=seq(0,3500,500));abline(h=gamma,lty=3,col='#aaa')
  for(cue in cues) {
    p<-truth[truth$scenario==scenario&truth$target_numerosity==n&truth$cue_validity==cue,];fp<-f[f$cue_validity==cue,];time<-seq(0,3500,5)
    lines(time,sat(time/1000,p$onset_ms/1000,p$rate_per_second,p$plateau),col=colours[cue],lwd=2)
    lines(time,sat(time/1000,fp$onset_ms/1000,fp$rate_per_second,fp$plateau),col=colours[cue],lty=2,lwd=1.5)
    a<-z[z$cue_validity==cue,];points(a$signal_delay_ms,a$observed_accuracy,col=adjustcolor(colours[cue],.75),pch=shapes[cue],cex=.75)
  }
}
par(mar=rep(0,4));plot.new();drawLegend()
mtext('SYNTHETIC: four spatial-cueing mechanisms using the full-task allocation',outer=TRUE,line=2,cex=1.2,font=2)
mtext('Concepts follow Image #3; numeric parameters use the reconstructed Image #1 table at six dots.',outer=TRUE,line=.5,cex=.85)
mtext('Solid: specified. Dashed: fitted generating-model family. Points: 45 synthetic participants.',side=1,outer=TRUE,line=.5,cex=.85)
dev.off()

# Standalone local HTML report with links to the data and inspectable assumptions.
esc<-function(x)gsub('>','&gt;',gsub('<','&lt;',gsub('&','&amp;',as.character(x),fixed=TRUE),fixed=TRUE),fixed=TRUE)
htmlTable<-function(d)paste0('<table><thead><tr>',paste0('<th>',esc(names(d)),'</th>',collapse=''),'</tr></thead><tbody>',paste(vapply(seq_len(nrow(d)),function(i)paste0('<tr>',paste0('<td>',esc(unlist(d[i,],use.names=FALSE)),'</td>',collapse=''),'</tr>'),''),collapse=''),'</tbody></table>')
selectedCounts<-as.data.frame.matrix(table(winners$scenario,winners$aic_winner))
selectedCounts<-cbind(generating_scenario=rownames(selectedCounts),selectedCounts);rownames(selectedCounts)<-NULL
boundary<-sum(recovery$parameter=='onset_ms'&recovery$estimate<.1)
failures<-sum(B-unique(recovery[c('target_numerosity','cue_validity','bootstrap_success')])$bootstrap_success)
html<-c('<!doctype html><meta charset="utf-8"><title>Figure-matched synthetic experiment</title><style>body{max-width:1100px;margin:45px auto;padding:0 24px;font:17px/1.55 system-ui;color:#23313c}img{width:100%}table{border-collapse:collapse;font-size:14px}td,th{border:1px solid #ddd;padding:7px 10px;text-align:right}th:first-child,td:first-child{text-align:left}.note{background:#eef5f8;padding:18px}a{color:#176e87}</style>',
  '<h1>Simulation following the three supplied figures</h1>',
  '<p class="note"><b>All observations are synthetic.</b> The values are rounded readings of the parameter image, not fitted human findings or the exact original source numbers. This is an ideal model-recovery benchmark, not a power analysis.</p>',
  '<p>Generated 45 participants, all 45 assignment versions, both complete sessions: <b>72,900 main trials per scenario</b>, 364,500 across five scenarios (null, onset only, rate only, plateau only, combined). Each participant has 1,620 main trials; every numerosity-by-delay cell contains 12 valid, 4 invalid and 4 neutral trials across sessions. At group level this gives 540 valid and 180 invalid/neutral observations per cell.</p>',
  '<p>The combined model also ran through both complete virtual production timelines, with all training and breaks. The deliberate edge-case injections from the earlier monkey were retained separately in those exports. Cohort fitting uses the ideal, all-timely cohort rather than these injected trials. No real-browser or physical timing is certified.</p>',
  '<h2>Generating model</h2><p><code>p(t) = 1/9 + (plateau - 1/9) × [1 - exp(-rate × max(0, t - onset)/1000)]</code></p>',
  '<p>Time is array onset to the scheduled tone, in milliseconds; rate is per second. The decision is assumed fixed at the tone. The first figure supplies the combined-condition table. For each single-component scenario, only that component differs between cues and the other components take the neutral values. The null scenario uses neutral parameters for all cues. The 1/9 floor follows the figures, assuming reports use 1–9; the actual pad also offers 0. No structural boundary at four dots is imposed.</p>',
  '<h2>Accuracy across all nine numerosities</h2><img src="combined_accuracy_curves.png" alt="Nine combined-condition accuracy curves with specified and recovered fits">',
  '<h2>Can the parameters be recovered?</h2><img src="parameter_recovery.png" alt="Onset, rise-rate and plateau parameter recovery">',
  '<p>All 225 candidate fits converged. The table gives root-mean-square error across the 27 unconstrained combined-scenario curves. Intervals in the plot use 200 parametric binomial bootstrap draws per curve, conditional on the fitted model and the present ideal design; they do not capture between-participant population uncertainty or guarantee coverage.</p>',htmlTable(data.frame(parameter=rmse$parameter,RMSE=signif(rmse$error,4))),
  sprintf('<p>%d onset estimates reached the zero lower boundary. %d of 5,400 bootstrap fits failed. Finite samples and onset/rate tradeoffs can make onset and rate less stable than the late plateau.</p>',boundary,failures),
  '<h2>Four candidate mechanisms</h2><img src="candidate_models.png" alt="Four cueing mechanisms at six dots">',
  '<p>The chart uses six dots and the actual nine signal delays. Its numbers inherit the Image #1 table, so it follows the mechanisms in Image #3 without claiming a pixel-exact reproduction of that independently illustrated panel.</p>',
  '<h2>Model selection from observed counts</h2><p>Each numerosity was fitted separately with binomial maximum likelihood. Candidate parameter counts are 3 (null), 5 (onset/rate/plateau only), and 9 (combined). The table counts AIC winners among the nine numerosities in each generating scenario. BIC results and every score are also saved. Similar-looking curves need not identify the generating mechanism, and one simulation is not a selection-accuracy estimate.</p>',htmlTable(selectedCounts),
  '<p>At one dot, all specified plateaus equal 0.99; therefore the plateau-only scenario there is identical to the null. Weak effects at small numerosities can also favour simpler models. AIC/BIC results here must not be interpreted as confirmatory tests of a neural processing stage.</p>',
  '<h2>How to use this check</h2><p>The actual design samples these ideal processing-time curves and can be inspected for onset/rate/plateau recovery. Whether a human dataset distinguishes the mechanisms needs repeated recovery simulations with pilot-supported participant slopes, image variability, timing failures, and response-signal compliance. Participants may continue processing during mouse movement, which is assumed absent here. The earliest scheduled observation is 100 ms, so very early onsets are extrapolated from the chosen SAT form. Exposure remains fixed at 66.7 ms.</p>',
  '<h2>Data and reproducibility</h2><ul>',
  '<li><a href="SYNTHETIC_figure_cohort.csv">Full synthetic cohort CSV</a></li><li><a href="generating_parameters.csv">Exact numeric parameter table used</a> and <a href="model_specification.json">assumptions</a></li>',
  '<li><a href="cohort_cell_counts.csv">Observed cell counts</a>, <a href="combined_parameter_recovery.csv">parameter recovery and intervals</a>, <a href="model_selection.csv">model selections</a>, <a href="candidate_model_comparisons.csv">all candidate scores</a></li>',
  '<li><a href="SYNTHETIC_reference_200_per_cell.csv">Separate dense reference simulation: 200 observations per time, cue and numerosity</a>; its extra times and equal cue counts are illustrative and are not the production schedule.</li>',
  '<li>Combined-model full virtual monkey: <a href="SYNTHETIC_MONKEY_s1.csv">session 1 CSV</a>, <a href="SYNTHETIC_MONKEY_s2.csv">session 2 CSV</a>; full event bundles are <code>SYNTHETIC_MONKEY_s1.json.gz</code> and <code>SYNTHETIC_MONKEY_s2.json.gz</code>.</li>',
  '<li><a href="validation.json">Software validation and source hashes</a>. Fixed seeds are in the scripts. Framework UUIDs and timestamps vary.</li></ul>',
  '<p>From the experiment folder run <code>npm run simulate:figures</code>, then <code>npm run analyse:figures</code>. Generation uses Node; analysis uses base R. Task parameters and production trial code were not changed.</p>')
writeLines(html,file.path(out,'REPORT.html'))
writeLines(capture.output(sessionInfo()),file.path(out,'R-session-info.txt'))
cat('\nRecovery RMSE:\n');print(rmse,row.names=FALSE)
cat('\nAIC winners:\n');print(selectedCounts,row.names=FALSE)
cat('\nBootstrap failures:',failures,'\nWritten:',out,'\n')
