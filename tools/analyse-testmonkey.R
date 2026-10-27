# Reproducible descriptive recovery of explicitly synthetic data; base R only.
args <- commandArgs(trailingOnly=TRUE)
out <- if(length(args)) args[1] else 'output/testmonkey'
d <- read.csv(file.path(out,'SYNTHETIC_cohort.csv'), stringsAsFactors=FALSE)
for(name in c('synthetic','numerical_correct','timing_compliant','timeout','late')) d[[name]]<-as.logical(d[[name]])
stopifnot(nrow(d)==291600L, all(d$synthetic), !anyDuplicated(d[c('scenario','participant_id','session','scheduled_order')]))
stopifnot(all(table(d$scenario,d$participant_id)==1620L))
stopifnot(all(d$array_duration_ms==200/3))
stopifnot(all(d$accuracy_all_scheduled==as.integer(!is.na(d$response)&d$response==d$target_numerosity&d$timing_compliant)))
counts <- aggregate(scheduled_order~scenario+participant_id+target_numerosity+signal_delay_ms+cue_validity,d,length)
stopifnot(all(counts$scheduled_order==ifelse(counts$cue_validity=='valid',12L,4L)))
write.csv(counts,file.path(out,'cell_counts.csv'),row.names=FALSE)
scenarios <- c('null','constant_logodds','faster_processing','persistent_fidelity')
titles <- c(null='No cue effect',constant_logodds='Constant log-odds effect',faster_processing='Faster processing',persistent_fidelity='Persistent fidelity')
colours <- c(valid='#007a53',neutral='#626a73',invalid='#c54f36')
delays <- sort(unique(d$signal_delay_ms))
# Equal weight to every numerosity x delay cell within participant and cue.
cells <- aggregate(cbind(accuracy_all_scheduled,generating_probability)~scenario+participant_id+target_numerosity+signal_delay_ms+cue_validity,d,mean)
# Expected all-scheduled accuracy includes the generating 2% timing-failure rate.
cells$expected_all_scheduled <- .98*cells$generating_probability
write.csv(cells,file.path(out,'participant_cells.csv'),row.names=FALSE)
summary <- aggregate(cbind(accuracy_all_scheduled,expected_all_scheduled)~scenario+target_numerosity+signal_delay_ms+cue_validity,cells,mean)
write.csv(summary,file.path(out,'accuracy_curves.csv'),row.names=FALSE)
result <- list(); k <- 0L
for(scenario in scenarios)for(group in c('all_1_9','small_1_3','transition_4_5','large_6_9'))for(window in c('all_delays','early_225_600','late_1600_3500')) {
  x <- cells[cells$scenario==scenario,]
  ns <- switch(group,all_1_9=1:9,small_1_3=1:3,transition_4_5=4:5,large_6_9=6:9)
  ds <- switch(window,all_delays=delays,early_225_600=c(225,350,600),late_1600_3500=c(1600,2500,3500))
  x <- x[x$target_numerosity%in%ns & x$signal_delay_ms%in%ds,]
  a <- aggregate(cbind(accuracy_all_scheduled,expected_all_scheduled)~participant_id+cue_validity,x,mean)
  for(pair in list(c('valid','invalid'),c('valid','neutral'),c('neutral','invalid'))) {
    left <- a[a$cue_validity==pair[1],]; right <- a[a$cue_validity==pair[2],]
    right <- right[match(left$participant_id,right$participant_id),]
    delta <- left$accuracy_all_scheduled-right$accuracy_all_scheduled
    fit <- t.test(delta)
    k<-k+1L;result[[k]] <- data.frame(scenario,group,window,contrast=paste(pair,collapse='_minus_'),participants=length(delta),estimate=mean(delta),ci_low=fit$conf.int[1],ci_high=fit$conf.int[2],p_unadjusted=fit$p.value,known_expected_difference=mean(left$expected_all_scheduled-right$expected_all_scheduled))
  }
}
contrasts <- do.call(rbind,result)
write.csv(contrasts,file.path(out,'recovered_contrasts.csv'),row.names=FALSE)
# Paired early-minus-late VI contrast; exploratory summary, not an omnibus LRT.
temporal <- list()
for(scenario in scenarios) {
  x <- cells[cells$scenario==scenario & cells$signal_delay_ms%in%c(225,350,600,1600,2500,3500),]
  x$window <- ifelse(x$signal_delay_ms<1000,'early','late')
  a <- aggregate(cbind(accuracy_all_scheduled,expected_all_scheduled)~participant_id+cue_validity+window,x,mean)
  get <- function(c,w,v) {z<-a[a$cue_validity==c&a$window==w,];z[order(z$participant_id),v]}
  delta <- get('valid','early','accuracy_all_scheduled')-get('invalid','early','accuracy_all_scheduled')-get('valid','late','accuracy_all_scheduled')+get('invalid','late','accuracy_all_scheduled')
  truth <- get('valid','early','expected_all_scheduled')-get('invalid','early','expected_all_scheduled')-get('valid','late','expected_all_scheduled')+get('invalid','late','expected_all_scheduled')
  fit <- t.test(delta)
  temporal[[scenario]]<-data.frame(scenario,estimate=mean(delta),ci_low=fit$conf.int[1],ci_high=fit$conf.int[2],p_unadjusted=fit$p.value,known_expected_difference=mean(truth))
}
write.csv(do.call(rbind,temporal),file.path(out,'temporal_contrasts.csv'),row.names=FALSE)

drawSummary <- function() {
  par(mfrow=c(2,2),mar=c(4.3,4.3,3,1),oma=c(0,0,2.8,0),las=1)
  for(scenario in scenarios) {
    z <- aggregate(cbind(accuracy_all_scheduled,expected_all_scheduled)~signal_delay_ms+cue_validity,summary[summary$scenario==scenario,],mean)
    plot(NA,xlim=range(delays),ylim=c(.05,1),log='x',xlab='Array-to-tone delay (ms, log scale)',ylab='Exact accuracy (all scheduled)',main=titles[scenario],xaxt='n')
    axis(1,at=c(100,350,1000,3500),labels=c('100','350','1000','3500'));abline(h=seq(.2,.8,.2),col='#e8e8e8')
    for(cue in names(colours)) {
      a<-z[z$cue_validity==cue,];a<-a[order(a$signal_delay_ms),]
      lines(a$signal_delay_ms,a$expected_all_scheduled,col=colours[cue],lty=2,lwd=1.3)
      lines(a$signal_delay_ms,a$accuracy_all_scheduled,col=colours[cue],type='b',pch=16,cex=.55,lwd=1.7)
    }
    legend('bottomright',c('Valid','Neutral','Invalid','Known expectation'),col=c(colours,'black'),lty=c(1,1,1,2),bty='n',cex=.72)
  }
  mtext('SYNTHETIC DATA: 45 participants, both full sessions; fixed 66.7 ms dot exposure',outer=TRUE,line=.7,cex=.95,font=2)
}
png(file.path(out,'synthetic_recovery.png'),width=1600,height=1100,res=150);drawSummary();dev.off()
png(file.path(out,'synthetic_by_numerosity.png'),width=2200,height=1800,res=150)
par(mfrow=c(3,3),mar=c(5,5,2.5,1),oma=c(1,1,4,0),las=1,mgp=c(2.6,.8,0),cex.lab=.9)
for(n in 1:9) {
  z<-summary[summary$scenario=='faster_processing'&summary$target_numerosity==n,]
  plot(NA,xlim=range(delays),ylim=c(.05,1),log='x',main=paste(n,'dots'),xlab='Array-to-tone delay (ms)',ylab='Exact accuracy',xaxt='n');axis(1,at=c(100,350,1000,3500),labels=c('100','350','1000','3500'))
  for(cue in names(colours)) {a<-z[z$cue_validity==cue,];a<-a[order(a$signal_delay_ms),];lines(a$signal_delay_ms,a$accuracy_all_scheduled,col=colours[cue],type='b',pch=16,lwd=2)}
  if(n==1)legend('bottomright',names(colours),col=colours,lty=1,bty='n',cex=.8)
}
mtext('SYNTHETIC faster-processing scenario by numerosity',outer=TRUE,line=2,font=2,cex=1.2)
mtext('Illustrative assumptions, not observed human performance; all-scheduled accuracy includes timing failures.',outer=TRUE,line=.6,cex=.85)
dev.off()

main <- contrasts[contrasts$group=='all_1_9'&contrasts$contrast=='valid_minus_invalid',]
fmt <- function(x) sprintf('%.1f',100*x)
lines <- c('# Synthetic full-experiment testmonkey report','',
  '**All data in this folder are artificial. Do not combine them with participant data.**','',
  '## What was executed','',
  '- The complete production entry-point timeline was traversed for session 1 at virtual 60 Hz and session 2 at virtual 120 Hz. Each session included 3 arrow questions, 5 number-pad checks, 5 unmasked tone trials, 8 masked practice trials, 810 main trials, and 8 breaks.',
  '- Every timed trial executed the unchanged production enumeration plugin with virtual canvas, mouse, frame and audio adapters. The real application callbacks and JSON/CSV export functions were used. jsPsych browser scheduling, native file downloads, fullscreen/pointer-lock permissions and IndexedDB recovery were not exercised.',
  '- Both sessions passed schedule-order, unique-ID, mask-completion, response-feedback and scoring assertions. Each retained 8 omissions, 7 late responses, 1 technical interruption, 6 ignored right clicks and 5 ignored pre-tone clicks. The interruptions were not replayed.',
  '- Session completion means all scheduled rows were recorded, including interrupted rows. It does not mean every row is valid for analysis.',
  '- There are 1,620 main plus 26 timed practice rows, in two compressed full JSON bundles and two CSV exports. JSON includes the complete planned schedules and raw trial events.',
  '- The illustrative response model gives roughly 50 minutes per session before realistic self-paced instructions and breaks. This is a simulated timing budget, not a human burden estimate.','',
  '## Can the current experiment answer the intended question?','',
  '**It can distinguish the supplied synthetic accuracy-versus-response-delay patterns at group level under these assumptions. This does not establish human sensitivity, identify a cognitive mechanism, or provide a sample-size justification.**','',
  'The implemented main experiment manipulates the tone delay (100-3,500 ms) while holding dot exposure at approximately 66.7 ms. Thus it addresses preparation and report accuracy over time following a brief display. It cannot directly estimate the exposure duration needed for accurate enumeration. Practice exposure variation does not supply a randomized main-task exposure manipulation.',
  'The older Revised_rationale_and_experiment_protocol.docx describes a different study with four target exposures, extended viewing and eye tracking. Its exposure-based H1 and extended-viewing H4 cannot be tested as written by this implementation. No task parameters were changed in this check.','',
  '## Illustrative effect recovery','',
  'The cohort contains 45 synthetic participants (all 45 assignment versions), two full sessions each, for each of four scenarios: 291,600 main rows. All comparisons use equal weighting across numerosities and delays within participant. Intervals are participant-level paired t intervals; they are nominal, unadjusted 95% intervals. They are descriptive recovery checks, not the preregistered primary mixed-model interaction or equivalence tests.','',
  '| Generating scenario | Delay window | Recovered valid-minus-invalid (percentage points, 95% CI) | Known expected difference |','|---|---|---|---|')
for(i in seq_len(nrow(main))) {r<-main[i,];lines<-c(lines,sprintf('| %s | %s | %s [%s, %s] | %s |',titles[r$scenario],r$window,fmt(r$estimate),fmt(r$ci_low),fmt(r$ci_high),fmt(r$known_expected_difference)))}
lines<-c(lines,'',
  'Early means 225, 350 and 600 ms; late means 1,600, 2,500 and 3,500 ms. These windows were selected for this synthetic check, not established by a human pilot. A late interval containing zero does not demonstrate equivalence or a plateau.',
  'The constant-log-odds scenario can show a changing percentage-point benefit even though its generating cue coefficient is fixed on the logit scale. Descriptive probability-scale temporal contrasts must not substitute for the planned model-scale interaction.','',
  '## Constraints to resolve before recruitment','',
  '1. Decide whether the research target is exposure duration or post-display processing time, then align the protocol, hypotheses and analysis with the actual manipulation.',
  '2. Validate response-signal compliance. The simulation assumes the decision is fixed at the tone and the subsequent mouse latency is purely reporting/motor time. Real participants could continue processing after the tone. Inspect rt_array_ms alongside rt_tone_ms; cue- or numerosity-dependent response delays can complicate interpretation.',
  '3. Pilot the performance curves, masks, cue use and fatigue with people. At two sessions combined, each participant has only 4 invalid and 4 neutral trials per numerosity-by-delay cell (12 valid). Individual cell fits and separate per-numerosity asymptotes will be noisy; pool or use a justified hierarchical model.',
  '4. Calibrate sample size using the final analysis, plausible human effects, participant cue/time slopes, item effects and retention. The synthetic cohort has baseline subject and item variation but no random cue slopes, condition-dependent omissions or fatigue, and is not a power analysis.',
  '5. Verify real-browser flow, screen and acoustic timing on the intended apparatus. The virtual timing flags are deterministic software checks. Fixation is not measured in this implementation.',
  '6. Account for the restricted 0-9 response scale when interpreting signed errors at nine dots. Above-nine reports are impossible. Synthetic error distributions here are assumptions, not validation of numerical bias.','',
  '## Files and reproducibility','',
  '- `SYNTHETIC_MONKEY_s1.csv`, `SYNTHETIC_MONKEY_s2.csv`: application-generated timed-trial summaries. Filter phase == "main". Exclude or model technical interruptions under an explicit rule; retain legitimate timing failures as appropriate to the estimand.',
  '- `SYNTHETIC_MONKEY_s1.json.gz`, `SYNTHETIC_MONKEY_s2.json.gz`: compressed full application bundles; decompress with gzip or a standard archive utility.',
  '- `SYNTHETIC_cohort.csv`: model-generated cohort scored by the production scoring function; this cohort did not traverse the UI/plugin.',
  '- `accuracy_curves.csv`, `participant_cells.csv`, `cell_counts.csv`, `recovered_contrasts.csv`, `temporal_contrasts.csv`: checks and analysis tables.',
  '- `synthetic_recovery.png`: four scenarios, observed curves and known expectations; `synthetic_by_numerosity.png`: nine numerosity panels.',
  '- `validation.json`: software assertions, environment limits, generation assumptions and source hashes.',
  '- Rerun from the experiment folder: `npm run testmonkey`, then `Rscript tools/analyse-testmonkey.R output/testmonkey`. No additional R packages are required.',
  '- Responses, errors, omissions and scenarios use fixed versioned seeds. Framework UUIDs and timestamps vary between runs; behavioural draws and schedule assignments are reproducible.','',
  'The production config, app, design, trial plugin and parameter documents were left unchanged. Test helpers were extracted for reuse by the monkey and the existing test suite.')
writeLines(lines,file.path(out,'REPORT.md'))
writeLines(capture.output(sessionInfo()),file.path(out,'R-session-info.txt'))
cat('Analysis and figures written to',out,'\n')
print(main[,c('scenario','window','estimate','ci_low','ci_high','known_expected_difference')],row.names=FALSE)
